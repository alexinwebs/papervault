import { prisma } from "@/lib/db";
import { conflict, forbidden, notFound, validation } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rateLimitAsync } from "@/lib/rate-limit";
import { assertVerifiedEmail, type SessionUser } from "@/lib/auth";
import { assertCollegeScope } from "../authz";
import { collegeIdOfPaper } from "./papers";
import { recordAudit } from "./audit";
import { notifyCommentReply } from "./notifications";

const paperCollegeSelect = {
  paperSet: {
    select: {
      examSession: {
        select: {
          subject: {
            select: {
              semester: {
                select: { branch: { select: { program: { select: { collegeId: true } } } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

const MAX_DEPTH = 2; // top-level comment + one level of replies

export const commentSelect = {
  id: true,
  body: true,
  status: true,
  parentId: true,
  createdAt: true,
  editedAt: true,
  removedReason: true,
  author: { select: { id: true, name: true, role: true, trustLevel: true } },
} as const;

export type CommentNode = Awaited<ReturnType<typeof listComments>>[number];

/** Whole thread for a paper, nested one level deep, oldest first. */
export async function listComments(paperId: string) {
  const rows = await prisma.comment.findMany({
    where: { paperId },
    orderBy: { createdAt: "asc" },
    // Bounded so one very long thread cannot make the paper page unboundedly
    // expensive; posting is rate limited well below this per user.
    take: 500,
    select: commentSelect,
  });

  const byId = new Map(rows.map((row) => [row.id, { ...row, replies: [] as typeof rows }]));
  const roots: Array<(typeof rows)[number] & { replies: typeof rows }> = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parent = row.parentId ? byId.get(row.parentId) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

export function commentCount(paperId: string) {
  return prisma.comment.count({ where: { paperId, status: "PUBLISHED" } });
}

/** A removed comment keeps its place in the thread but hides its text. */
export function publicBody(comment: { status: string; body: string; removedReason?: string | null }) {
  if (comment.status === "PUBLISHED") return comment.body;
  return comment.removedReason
    ? `This comment was removed by a moderator: ${comment.removedReason}`
    : "This comment was removed by a moderator.";
}

export async function addComment(
  actor: SessionUser,
  input: { paperId: string; parentId?: string | null; body: string },
) {
  assertVerifiedEmail(actor);
  // Two windows: a burst guard and an hourly cap against flooding a thread.
  await rateLimitAsync(`comment:burst:${actor.id}`, 5, 60_000);
  await rateLimitAsync(`comment:hour:${actor.id}`, 60, 60 * 60_000);

  const paper = await prisma.paper.findFirst({
    where: { id: input.paperId, deletedAt: null },
    select: { id: true, title: true, status: true, ...paperCollegeSelect },
  });
  if (!paper) throw notFound("Paper");
  if (paper.status !== "PUBLISHED") {
    // Only staff of the paper's own college may discuss it before publication.
    try {
      assertCollegeScope(actor, collegeIdOfPaper(paper));
    } catch {
      throw forbidden("Discussion opens once the paper is published.");
    }
  }

  let parent = null;
  if (input.parentId) {
    parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { id: true, paperId: true, parentId: true, authorId: true, status: true },
    });
    if (!parent || parent.paperId !== paper.id) throw notFound("Comment");
    if (parent.status !== "PUBLISHED") throw conflict("That comment was removed.");
    // Flatten deeper replies onto the top-level parent rather than nesting.
    if (parent.parentId) {
      const grandparent = await prisma.comment.findUnique({
        where: { id: parent.parentId },
        select: { id: true, authorId: true },
      });
      if (grandparent && MAX_DEPTH === 2) {
        parent = { ...parent, id: grandparent.id };
      }
    }
  }

  const comment = await prisma.comment.create({
    data: {
      paperId: paper.id,
      authorId: actor.id,
      parentId: parent?.id ?? null,
      body: input.body.trim(),
    },
    select: commentSelect,
  });

  await recordAudit({
    actorId: actor.id,
    action: "comment.created",
    entityType: "Comment",
    entityId: comment.id,
    after: { paperId: paper.id },
  });

  // Tell the person being replied to, if it is not themselves.
  if (input.parentId) {
    try {
      const target = await prisma.comment.findUnique({
        where: { id: input.parentId },
        select: { author: { select: { id: true, email: true, notifyOnReply: true } } },
      });
      if (target?.author && target.author.id !== actor.id && target.author.notifyOnReply) {
        await notifyCommentReply({
          to: target.author.email,
          userId: target.author.id,
          paperId: paper.id,
          paperTitle: paper.title,
          authorName: actor.name,
          excerpt: comment.body.slice(0, 180),
        });
      }
    } catch (err) {
      logger.error("comment_reply_notification_failed", { error: String(err) });
    }
  }

  return comment;
}

const EDIT_WINDOW_MS = 15 * 60_000;

export async function editComment(actor: SessionUser, input: { commentId: string; body: string }) {
  const comment = await prisma.comment.findUnique({ where: { id: input.commentId } });
  if (!comment) throw notFound("Comment");
  if (comment.authorId !== actor.id) throw forbidden("You can only edit your own comments.");
  if (comment.status !== "PUBLISHED") throw conflict("That comment was removed.");
  if (Date.now() - comment.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw conflict("Comments can only be edited within 15 minutes of posting.");
  }
  return prisma.comment.update({
    where: { id: comment.id },
    data: { body: input.body.trim(), editedAt: new Date() },
    select: commentSelect,
  });
}

/** Authors delete their own; moderators remove anyone's with a reason. */
export async function removeComment(
  actor: SessionUser,
  input: { commentId: string; reason?: string },
) {
  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    include: { paper: { select: paperCollegeSelect } },
  });
  if (!comment) throw notFound("Comment");
  const isAuthor = comment.authorId === actor.id;
  if (!isAuthor) {
    // Moderators act on their own college's papers only, like everywhere else.
    assertCollegeScope(actor, collegeIdOfPaper(comment.paper));
  }
  if (comment.status === "REMOVED") throw conflict("That comment is already removed.");

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: {
      status: "REMOVED",
      removedById: actor.id,
      removedReason: isAuthor ? null : input.reason?.trim() || "Breached the discussion guidelines.",
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: isAuthor ? "comment.deleted_by_author" : "comment.removed_by_moderator",
    entityType: "Comment",
    entityId: comment.id,
    before: { body: comment.body.slice(0, 200) },
  });
  return updated;
}

export async function reportComment(
  actor: SessionUser,
  input: { commentId: string; reason: string; details?: string },
) {
  assertVerifiedEmail(actor);
  await rateLimitAsync(`report:${actor.id}`, 10, 60 * 60_000);
  const comment = await prisma.comment.findUnique({ where: { id: input.commentId } });
  if (!comment) throw notFound("Comment");
  if (comment.authorId === actor.id) throw validation("You cannot report your own comment.");

  const existing = await prisma.report.findFirst({
    where: { commentId: comment.id, reportedById: actor.id, status: "OPEN" },
  });
  if (existing) throw conflict("You have already reported this comment.");

  return prisma.report.create({
    data: {
      paperId: comment.paperId,
      commentId: comment.id,
      reportedById: actor.id,
      reason: input.reason,
      details: input.details?.trim() || null,
    },
  });
}

/** Comments awaiting moderator attention, scoped to the college when needed. */
export function reportedComments(collegeId: string | null) {
  return prisma.report.findMany({
    where: {
      status: "OPEN",
      commentId: { not: null },
      ...(collegeId
        ? {
            paper: {
              paperSet: {
                examSession: {
                  subject: {
                    semester: { branch: { program: { collegeId } } },
                  },
                },
              },
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      reportedBy: { select: { id: true, name: true } },
      comment: { select: commentSelect },
      paper: { select: { id: true, title: true } },
    },
  });
}
