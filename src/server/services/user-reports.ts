import { prisma } from "@/lib/db";
import { conflict, notFound, validation } from "@/lib/errors";
import { assertVerifiedEmail, type SessionUser } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { USER_REPORT_REASON_LABEL, type UserReportReason } from "@/lib/constants";
import { assertPlatformAdmin } from "../authz";
import { recordAudit } from "./audit";
import { notifyAdmins } from "./notifications";

/** Report a member (spam, harassment, impersonation…). Reviewed by platform admins. */
export async function reportUser(
  actor: SessionUser,
  input: { userId: string; reason: UserReportReason; details?: string | null },
) {
  assertVerifiedEmail(actor);
  if (input.userId === actor.id) throw validation("You can't report yourself.");
  await rateLimitAsync(`report:${actor.id}`, 10, 60 * 60_000);
  const target = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, anonymizedAt: true } });
  if (!target || target.anonymizedAt) throw notFound("Member");
  const existing = await prisma.userReport.findFirst({
    where: { reportedUserId: target.id, reportedById: actor.id, status: "OPEN" },
    select: { id: true },
  });
  if (existing) throw conflict("You've already reported this member. We'll review it.");
  const report = await prisma.userReport.create({
    data: { reportedUserId: target.id, reportedById: actor.id, reason: input.reason, details: input.details?.trim() || null },
  });
  await recordAudit({
    actorId: actor.id,
    action: "user_report.created",
    entityType: "User",
    entityId: target.id,
    after: { reason: input.reason },
  });
  await notifyAdmins({
    type: "user_report.created",
    caseId: `UR-${report.id.slice(-8).toUpperCase()}`,
    title: "Member reported",
    summary: `${target.name} — ${USER_REPORT_REASON_LABEL[input.reason]}`,
    href: "/admin/reports?tab=users",
    member: actor.name,
  });
  return report;
}

export function openUserReports(actor: SessionUser) {
  assertPlatformAdmin(actor);
  return prisma.userReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      reportedUser: { select: { id: true, name: true, status: true, role: true } },
      reportedBy: { select: { id: true, name: true } },
    },
  });
}

export async function resolveUserReport(
  actor: SessionUser,
  input: { reportId: string; status: "RESOLVED" | "DISMISSED"; resolution?: string | null },
) {
  assertPlatformAdmin(actor);
  const updated = await prisma.userReport.updateMany({
    where: { id: input.reportId, status: "OPEN" },
    data: { status: input.status, resolution: input.resolution?.trim() || null, reviewedById: actor.id, reviewedAt: new Date() },
  });
  if (updated.count === 0) throw conflict("This report has already been handled.");
  await recordAudit({
    actorId: actor.id,
    action: `user_report.${input.status.toLowerCase()}`,
    entityType: "UserReport",
    entityId: input.reportId,
    reason: input.resolution?.trim() || null,
  });
}
