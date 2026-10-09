import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import type { ReportReason } from "@/lib/constants";
import { recordAudit } from "./audit";
import { transitionPaper } from "./papers";

export async function fileReport(
  user: SessionUser,
  input: { paperId: string; reason: ReportReason; details?: string },
) {
  const paper = await prisma.paper.findUnique({ where: { id: input.paperId } });
  if (!paper) throw notFound("Paper");

  const report = await prisma.report.create({
    data: {
      paperId: paper.id,
      reportedById: user.id,
      reason: input.reason,
      details: input.details?.trim() || null,
    },
  });

  // A credible current-exam report takes the paper out of circulation immediately.
  if (input.reason === "CURRENT_OR_UPCOMING_EXAM" && paper.status === "PUBLISHED") {
    await transitionPaper({
      paperId: paper.id,
      to: "RESTRICTED",
      actorId: null,
      note: "Auto-restricted after a current/upcoming exam report.",
      restrictedReason: "Reported as current or upcoming exam material. Under review.",
    });
  }

  await recordAudit({
    actorId: user.id,
    action: "report.created",
    entityType: "Paper",
    entityId: paper.id,
    after: { reason: input.reason },
  });

  return report;
}
