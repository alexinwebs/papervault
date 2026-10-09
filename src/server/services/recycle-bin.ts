import { prisma, prismaRaw } from "@/lib/db";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/lib/auth";
import { assertCollegeScope, assertPlatformAdmin } from "../authz";
import { recordAudit } from "./audit";
import { pushInbox } from "./inbox";
import { storage } from "@/lib/storage";

/** How long a deleted paper stays recoverable before the purge job removes it. */
export const RETENTION_DAYS = 30;

function assertScope(actor: SessionUser, paperCollegeId: string) {
  assertCollegeScope(actor, paperCollegeId);
}

async function collegeIdFor(paperId: string) {
  const paper = await prismaRaw.paper.findUnique({
    where: { id: paperId },
    select: {
      id: true,
      title: true,
      deletedAt: true,
      uploadedById: true,
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
    },
  });
  if (!paper) throw notFound("That paper no longer exists.");
  const collegeId = paper.paperSet.examSession.subject.semester.branch.program.collegeId;
  return { paper, collegeId };
}

/** Moves a paper to the recycle bin. Reversible for RETENTION_DAYS. */
export async function softDeletePaper(actor: SessionUser, input: { paperId: string; reason: string }) {
  const { paper, collegeId } = await collegeIdFor(input.paperId);
  assertScope(actor, collegeId);
  if (paper.deletedAt) throw conflict("That paper is already in the recycle bin.");

  await prismaRaw.paper.update({
    where: { id: paper.id },
    data: { deletedAt: new Date(), deletedById: actor.id, status: "REMOVED" },
  });

  await recordAudit({
    actorId: actor.id,
    action: "paper.soft_deleted",
    entityType: "Paper",
    entityId: paper.id,
    after: JSON.stringify({ reason: input.reason }),
  });

  if (paper.uploadedById) {
    await pushInbox({
      userId: paper.uploadedById,
      type: "paper.removed",
      title: `${paper.title} was removed`,
      body: `A moderator removed this paper from the archive. Reason: ${input.reason}`,
    });
  }

  logger.info("paper_soft_deleted", { paperId: paper.id, actorId: actor.id });
}

export async function restorePaper(actor: SessionUser, input: { paperId: string }) {
  const { paper, collegeId } = await collegeIdFor(input.paperId);
  assertScope(actor, collegeId);
  if (!paper.deletedAt) throw conflict("That paper is not in the recycle bin.");

  // Restored papers re-enter review rather than going straight back live.
  await prismaRaw.paper.update({
    where: { id: paper.id },
    data: { deletedAt: null, deletedById: null, status: "PENDING_REVIEW" },
  });

  await recordAudit({
    actorId: actor.id,
    action: "paper.restored",
    entityType: "Paper",
    entityId: paper.id,
  });

  if (paper.uploadedById) {
    await pushInbox({
      userId: paper.uploadedById,
      type: "paper.restored",
      title: `${paper.title} was restored`,
      body: "A moderator restored your paper. It is back in the review queue.",
      href: `/papers/${paper.id}`,
    });
  }
}

/** Permanently removes a paper and its stored file. Platform admins only. */
export async function purgePaper(actor: SessionUser, input: { paperId: string }) {
  assertPlatformAdmin(actor);
  const paper = await prismaRaw.paper.findUnique({
    where: { id: input.paperId },
    select: { id: true, deletedAt: true, files: { select: { id: true, storageKey: true } } },
  });
  if (!paper) throw notFound("That paper no longer exists.");
  if (!paper.deletedAt) throw conflict("Only papers in the recycle bin can be purged.");

  for (const file of paper.files) {
    await storage().delete(file.storageKey).catch((err) =>
      logger.error("purge_file_failed", { storageKey: file.storageKey, error: String(err) }),
    );
  }
  await prismaRaw.paper.delete({ where: { id: paper.id } });

  await recordAudit({
    actorId: actor.id,
    action: "paper.purged",
    entityType: "Paper",
    entityId: paper.id,
  });
  logger.info("paper_purged", { paperId: paper.id, actorId: actor.id });
}

export function deletedPapers(collegeId: string | null) {
  return prismaRaw.paper.findMany({
    where: {
      deletedAt: { not: null },
      ...(collegeId
        ? {
            paperSet: {
              examSession: {
                subject: { semester: { branch: { program: { collegeId } } } },
              },
            },
          }
        : {}),
    },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true,
      title: true,
      deletedAt: true,
      uploadedBy: { select: { name: true } },
      deletedBy: { select: { name: true } },
    },
  });
}

/**
 * Removes papers whose retention window has passed. Safe to call repeatedly;
 * intended for a nightly cron hitting /api/cron/purge.
 */
export async function purgeExpiredPapers(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000);
  const expired = await prismaRaw.paper.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, files: { select: { storageKey: true } } },
  });

  for (const paper of expired) {
    for (const file of paper.files) {
      await storage().delete(file.storageKey).catch((err) =>
        logger.error("purge_file_failed", { storageKey: file.storageKey, error: String(err) }),
      );
    }
    await prismaRaw.paper.delete({ where: { id: paper.id } });
  }

  if (expired.length > 0) logger.info("papers_purged", { count: expired.length });
  return expired.length;
}
