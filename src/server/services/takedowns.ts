import { prisma } from "@/lib/db";
import { conflict, notFound, validation } from "@/lib/errors";
import { assertCanModerate, assertCollegeScope, assertPlatformAdmin } from "../authz";
import { logger } from "@/lib/logger";
import { rateLimitAsync } from "@/lib/rate-limit";
import type { SessionUser } from "@/lib/auth";
import { recordAudit } from "./audit";
import { sendAccountEmail } from "./notifications";

/** Pulls a paper id out of a PaperVault URL so moderators get a direct link. */
export function paperIdFromUrl(url: string): string | null {
  const match = /\/papers\/([A-Za-z0-9_-]{10,})/.exec(url);
  return match ? match[1] : null;
}

export async function fileTakedown(input: {
  paperUrl: string;
  claimantName: string;
  claimantEmail: string;
  claimantOrg?: string | null;
  claimantRole: string;
  reason: string;
  statementSigned: boolean;
  requestIp?: string | null;
}) {
  if (!input.statementSigned) {
    throw validation("Please confirm the good-faith statement before submitting.");
  }
  // Unauthenticated endpoint, so the limit is keyed on the claimant email and
  // the request IP together.
  await rateLimitAsync(`takedown:${input.claimantEmail.toLowerCase()}`, 5, 60 * 60_000);
  if (input.requestIp) await rateLimitAsync(`takedown:ip:${input.requestIp}`, 20, 60 * 60_000);

  const candidateId = paperIdFromUrl(input.paperUrl);
  const paper = candidateId
    ? await prisma.paper.findUnique({ where: { id: candidateId }, select: { id: true } })
    : null;

  const request = await prisma.takedownRequest.create({
    data: {
      paperUrl: input.paperUrl,
      paperId: paper?.id ?? null,
      claimantName: input.claimantName,
      claimantEmail: input.claimantEmail,
      claimantOrg: input.claimantOrg || null,
      claimantRole: input.claimantRole,
      reason: input.reason,
      statementSigned: true,
    },
    select: { id: true },
  });

  logger.info("takedown_filed", { id: request.id, matchedPaper: Boolean(paper) });

  const reference = request.id.slice(-8).toUpperCase();
  await sendAccountEmail({
    to: input.claimantEmail,
    type: "takedown.received",
    subject: `We received your takedown notice (${reference})`,
    title: "Your takedown notice is logged",
    lines: [
      `Hello ${escapeHtml(input.claimantName)},`,
      `We have logged your notice about <code>${escapeHtml(input.paperUrl)}</code>. A moderator will review it, normally within two working days. If the material is clearly not permitted we remove it first and review afterwards.`,
      `Your reference is <strong>${reference}</strong>. Reply to this email to add information.`,
    ],
  });

  return request;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
  );
}

const paperCollege = {
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

/**
 * Notices carry claimant names and emails, so a moderator only sees the ones
 * about papers from their own college. Notices that did not resolve to a paper
 * are platform-admin work.
 */
export function openTakedowns(actor: SessionUser) {
  assertCanModerate(actor);
  const scope =
    actor.role === "PLATFORM_ADMIN"
      ? {}
      : {
          paper: {
            paperSet: {
              examSession: {
                subject: { semester: { branch: { program: { collegeId: actor.collegeId ?? "-" } } } },
              },
            },
          },
        };
  return prisma.takedownRequest.findMany({
    where: { status: { in: ["OPEN", "UNDER_REVIEW", "REVIEW_REQUESTED"] }, ...scope },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { paper: { select: { id: true, title: true, status: true } } },
  });
}

export function recentActionedTakedowns(actor: SessionUser) {
  assertCanModerate(actor);
  const scope =
    actor.role === "PLATFORM_ADMIN"
      ? {}
      : {
          paper: {
            paperSet: {
              examSession: {
                subject: { semester: { branch: { program: { collegeId: actor.collegeId ?? "-" } } } },
              },
            },
          },
        };
  return prisma.takedownRequest.findMany({
    where: { status: "ACTIONED", handledAt: { gte: new Date(Date.now() - 90 * 86_400_000) }, ...scope },
    orderBy: { handledAt: "desc" },
    take: 50,
    include: { paper: { select: { id: true, title: true, status: true } } },
  });
}

export async function resolveTakedown(
  actor: SessionUser,
  input: {
    id: string;
    status: "UNDER_REVIEW" | "ACTIONED" | "REJECTED" | "REVIEW_REQUESTED" | "RESTORED" | "CLOSED";
    resolution: string;
  },
) {
  const existing = await prisma.takedownRequest.findUnique({
    where: { id: input.id },
    include: { paper: { select: paperCollege } },
  });
  if (!existing) throw notFound("That takedown request no longer exists.");
  if (existing.paper) {
    assertCollegeScope(
      actor,
      existing.paper.paperSet.examSession.subject.semester.branch.program.collegeId,
    );
  } else {
    assertPlatformAdmin(actor);
  }

  // Case workflow: submitted (OPEN) -> under review -> actioned | rejected;
  // after action the uploader may contest (review requested) -> restored |
  // closed. Each update is conditional on the expected prior states so two
  // moderators (or a replayed form) cannot act twice and email twice.
  const from: Record<typeof input.status, string[]> = {
    UNDER_REVIEW: ["OPEN"],
    ACTIONED: ["OPEN", "UNDER_REVIEW"],
    REJECTED: ["OPEN", "UNDER_REVIEW"],
    REVIEW_REQUESTED: ["ACTIONED"],
    RESTORED: ["REVIEW_REQUESTED"],
    CLOSED: ["OPEN", "UNDER_REVIEW", "ACTIONED", "REJECTED", "REVIEW_REQUESTED", "RESTORED"],
  };
  const claimed = await prisma.takedownRequest.updateMany({
    where: { id: input.id, status: { in: from[input.status] } },
    data: {
      status: input.status,
      resolution: input.resolution,
      handledById: actor.id,
      handledAt: new Date(),
      ...(input.status === "REVIEW_REQUESTED"
        ? { reviewRequest: input.resolution, reviewRequestedAt: new Date() }
        : {}),
    },
  });
  if (claimed.count === 0) {
    throw conflict(`That notice can't move from ${existing.status.toLowerCase()} to ${input.status.toLowerCase()}.`);
  }

  await recordAudit({
    actorId: actor.id,
    action: `takedown.${input.status.toLowerCase()}`,
    entityType: "TakedownRequest",
    entityId: input.id,
    before: { status: existing.status },
    after: { status: input.status },
    reason: input.resolution,
  });

  // The claimant hears about outcomes, not internal bookkeeping.
  if (input.status !== "ACTIONED" && input.status !== "REJECTED" && input.status !== "RESTORED") return;

  await sendAccountEmail({
    to: existing.claimantEmail,
    type: "takedown.resolved",
    subject: `Your takedown notice ${input.id.slice(-8).toUpperCase()} has been reviewed`,
    title:
      input.status === "ACTIONED"
        ? "Your notice was actioned"
        : input.status === "RESTORED"
          ? "Material restored after review"
          : "Your notice was declined",
    lines: [
      `Hello ${escapeHtml(existing.claimantName)},`,
      `Your notice about <code>${escapeHtml(existing.paperUrl)}</code> has been ${
        input.status === "ACTIONED"
          ? "actioned"
          : input.status === "RESTORED"
            ? "reconsidered after the uploader asked for a review, and the material has been restored"
            : "reviewed and declined"
      }.`,
      escapeHtml(input.resolution),
    ],
  });
}
