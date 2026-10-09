import { prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import type { UserStatus } from "@/lib/constants";
import { recordAudit } from "./audit";
import { notifyUser } from "./notifications";

const MESSAGE: Record<UserStatus, string> = {
  ACTIVE: "Your account is in good standing again.",
  WARNED:
    "A moderator reviewed activity on your account and issued a warning. Please read the Community Guidelines; repeated issues can lead to restrictions.",
  RESTRICTED:
    "Your account is restricted: you can still browse and contact support, but you can't upload, comment or report for now.",
  SUSPENDED: "Your account has been suspended.",
  BANNED: "Your account has been banned.",
};

/**
 * Sets a member's standing. One function so every path (member page, report
 * review) applies the same rules: no self-action, the last platform admin is
 * untouchable, sessions are revoked for suspensions and bans, the member is
 * told, and the change is audited with its reason.
 */
export async function setUserStanding(
  actor: SessionUser,
  input: { userId: string; status: UserStatus; reason?: string | null; days?: number | null },
) {
  const target = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!target) throw notFound("Member");
  if (target.anonymizedAt) throw conflict("This account has been erased.");
  if (target.id === actor.id && input.status !== "ACTIVE") {
    throw conflict("You cannot change your own account standing.");
  }
  if (target.role === "PLATFORM_ADMIN" && (input.status === "SUSPENDED" || input.status === "BANNED")) {
    const remaining = await prisma.user.count({
      where: { role: "PLATFORM_ADMIN", bannedAt: null, anonymizedAt: null, NOT: { id: target.id } },
    });
    if (remaining === 0) throw conflict("This is the last platform admin and cannot be suspended or banned.");
  }

  const reason = input.reason?.trim() || null;
  const now = new Date();
  const until =
    input.status === "SUSPENDED" && input.days ? new Date(now.getTime() + input.days * 86_400_000) : null;
  const locksOut = input.status === "SUSPENDED" || input.status === "BANNED";

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        status: input.status,
        statusReason: input.status === "ACTIVE" ? null : reason,
        statusUntil: until,
        bannedAt: input.status === "BANNED" ? now : null,
        banReason: input.status === "BANNED" ? reason ?? "Banned by a platform admin." : null,
        ...(locksOut ? { credentialsSetAt: now } : {}),
      },
    });
    if (locksOut) await tx.session.deleteMany({ where: { userId: target.id } });
  });

  await recordAudit({
    actorId: actor.id,
    action: `user.standing.${input.status.toLowerCase()}`,
    entityType: "User",
    entityId: target.id,
    before: { status: target.status },
    after: { status: input.status, until: until?.toISOString() },
    reason,
  });

  // Suspended and banned members cannot sign in to read their inbox, so the
  // email is what reaches them; the inbox row is kept for when they return.
  if (input.status !== target.status) {
    const untilText = until
      ? ` until ${until.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : "";
    await notifyUser({
      userId: target.id,
      type: `account.${input.status.toLowerCase()}`,
      title: input.status === "ACTIVE" ? "Your account is active" : `Account ${input.status.toLowerCase()}`,
      body: `${MESSAGE[input.status].replace(/\.$/, untilText + ".")}${reason ? ` Reason: ${reason}` : ""}`,
      href: "/settings",
    });
  }
  return { status: input.status, until };
}
