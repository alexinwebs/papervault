import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, validation } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import { assertCollegeScope } from "../authz";
import { moderationDecisionSchema } from "../validators";
import { paperById } from "../repositories/papers";
import { collegeIdOfPaper, settleClassificationForRelease, transitionPaper } from "./papers";
import { recordAudit } from "./audit";
import { notifyDecision } from "./notifications";
import { logger } from "@/lib/logger";

type Decision = z.infer<typeof moderationDecisionSchema>;

/** Moderator decisions. Tenant scope is enforced from the server session only. */
export async function decide(user: SessionUser, decision: Decision) {
  const updated = await applyDecision(user, decision);
  await sendDecisionEmail(decision.paperId, updated.status, decision.note?.trim() || null);
  return updated;
}

/**
 * Emails the contributor about the outcome. Isolated from the transition so a
 * mail outage can never roll back a moderation decision.
 */
export async function sendDecisionEmail(paperId: string, status: string, note: string | null) {
  try {
    const full = await prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        paperSet: {
          include: {
            examSession: {
              include: {
                examType: true,
                subject: {
                  include: {
                    semester: {
                      include: { branch: { include: { program: { include: { college: true } } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!full?.uploadedBy) return;
    const session = full.paperSet.examSession;
    const subject = session.subject;
    const branch = subject.semester.branch;
    await notifyDecision({
      paperId: full.id,
      title: full.title,
      status,
      collegeId: branch.program.college.id,
      collegeName: branch.program.college.name,
      context: `${subject.code} · ${branch.program.name} ${branch.code} · Semester ${subject.semester.number} · ${session.examType.name} ${session.academicYear}`,
      uploaderName: full.uploadedBy.name,
      uploaderEmail: full.uploadedBy.email,
      uploaderId: full.uploadedBy.id,
      note,
    });
  } catch (err) {
    logger.error("decision_notification_failed", { error: String(err) });
  }
}

/**
 * Restricted papers (held automatically for the current exam cycle, or by a
 * moderator) go back to review before they can be approved. Returns the
 * status the paper is in afterwards.
 */
async function liftRestriction(
  paper: { id: string; status: string },
  actorId: string,
  note: string | null,
) {
  if (paper.status !== "RESTRICTED") return paper.status;
  await transitionPaper({
    paperId: paper.id,
    to: "PENDING_REVIEW",
    actorId,
    note: note ?? "Restriction lifted by a moderator.",
  });
  return "PENDING_REVIEW";
}

async function applyDecision(user: SessionUser, decision: Decision) {
  const paper = await paperById(decision.paperId);
  if (!paper) throw notFound("Paper");
  assertCollegeScope(user, collegeIdOfPaper(paper));

  const note = decision.note?.trim() || null;

  switch (decision.action) {
    case "APPROVE":
      await settleClassificationForRelease(paper.id, user.id, decision.examClassification || null);
      await liftRestriction(paper, user.id, note);
      return transitionPaper({
        paperId: paper.id,
        to: "APPROVED",
        actorId: user.id,
        note,
        verification:
          decision.verification ??
          (user.role === "COLLEGE_ADMIN" ? "COLLEGE_VERIFIED" : "MODERATOR_VERIFIED"),
      });
    case "PUBLISH": {
      // Publishing is the moderator's final word, so walk the paper through
      // the intermediate states instead of making them click three times.
      await settleClassificationForRelease(paper.id, user.id, decision.examClassification || null);
      const status = await liftRestriction(paper, user.id, note);
      if (status === "PENDING_REVIEW") {
        await transitionPaper({
          paperId: paper.id,
          to: "APPROVED",
          actorId: user.id,
          note,
          verification:
            decision.verification ??
            (user.role === "COLLEGE_ADMIN" ? "COLLEGE_VERIFIED" : "MODERATOR_VERIFIED"),
        });
      }
      return transitionPaper({ paperId: paper.id, to: "PUBLISHED", actorId: user.id, note });
    }
    case "REJECT":
      return transitionPaper({ paperId: paper.id, to: "REJECTED", actorId: user.id, note });
    case "REQUEST_CHANGES":
      return transitionPaper({
        paperId: paper.id,
        to: "CHANGES_REQUESTED",
        actorId: user.id,
        note: note ?? "More detail needed.",
      });
    case "RESTRICT":
      return transitionPaper({
        paperId: paper.id,
        to: "RESTRICTED",
        actorId: user.id,
        note,
        restrictedReason: note ?? "Restricted by a moderator.",
      });
    case "MERGE": {
      if (!decision.canonicalPaperId) throw validation("Choose the canonical paper to merge into.");
      const canonical = await paperById(decision.canonicalPaperId);
      if (!canonical) throw notFound("Canonical paper");
      assertCollegeScope(user, collegeIdOfPaper(canonical));
      await prisma.paperFile.updateMany({
        where: { paperId: paper.id },
        data: { paperId: canonical.id },
      });
      return transitionPaper({
        paperId: paper.id,
        to: "MERGED",
        actorId: user.id,
        note: note ?? `Merged into ${canonical.id}`,
        canonicalId: canonical.id,
      });
    }
    default:
      throw validation("Unknown moderation action.");
  }
}

export async function resolveReport(
  user: SessionUser,
  input: { reportId: string; status: "RESOLVED" | "DISMISSED"; resolution?: string },
) {
  const report = await prisma.report.findUnique({
    where: { id: input.reportId },
    include: { paper: { include: { paperSet: { include: { examSession: { include: { subject: { include: { semester: { include: { branch: { include: { program: true } } } } } } } } } } } } },
  });
  if (!report) throw notFound("Report");
  assertCollegeScope(
    user,
    report.paper.paperSet.examSession.subject.semester.branch.program.collegeId,
  );
  const updated = await prisma.report.update({
    where: { id: report.id },
    data: {
      status: input.status,
      resolution: input.resolution?.trim() || null,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });
  await recordAudit({
    actorId: user.id,
    action: `report.${input.status.toLowerCase()}`,
    entityType: "Report",
    entityId: report.id,
    before: { status: report.status },
    after: { status: updated.status },
  });
  return updated;
}

export function openReports(collegeId?: string | null) {
  return prisma.report.findMany({
    where: {
      status: "OPEN",
      ...(collegeId
        ? {
            paper: {
              paperSet: {
                examSession: {
                  subject: { semester: { branch: { program: { collegeId } } } },
                },
              },
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      paper: { select: { id: true, title: true, status: true } },
      reportedBy: { select: { name: true } },
    },
  });
}
