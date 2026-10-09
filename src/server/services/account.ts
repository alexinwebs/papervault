import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { conflict, notFound, validation } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { issueToken, consumeToken } from "@/lib/tokens";
import { revokeOtherSessions, type SessionUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";
import { recordAudit } from "./audit";
import { sendAccountEmail } from "./notifications";
import { siteUrl } from "@/lib/site";

/* --------------------------- email verification -------------------------- */

export async function sendVerificationEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (user.emailVerifiedAt) return { alreadyVerified: true };

  const raw = await issueToken(user.id, "EMAIL_VERIFY");
  await sendAccountEmail({
    to: user.email,
    userId: user.id,
    type: "account.verify_email",
    subject: "[PaperVault] Confirm your email address",
    title: "Confirm your email address",
    lines: [
      `Hi ${user.name}, welcome to PaperVault.`,
      "Confirm this address so you can upload papers and join discussions. The link is valid for 24 hours.",
    ],
    cta: { label: "Confirm my email", href: `${siteUrl()}/verify-email?token=${raw}` },
  });
  return { alreadyVerified: false };
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) throw validation("That confirmation link is invalid or has expired.");
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  await recordAudit({
    actorId: user.id,
    action: "user.email_verified",
    entityType: "User",
    entityId: user.id,
  });
  return user;
}

/* ----------------------------- password reset ---------------------------- */

/**
 * Always resolves the same way whether or not the address exists, so the form
 * cannot be used to enumerate accounts.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    logger.info("password_reset_unknown_email");
    return;
  }
  const raw = await issueToken(user.id, "PASSWORD_RESET");
  await sendAccountEmail({
    to: user.email,
    userId: user.id,
    type: "account.password_reset",
    subject: "[PaperVault] Reset your password",
    title: "Reset your password",
    lines: [
      `Hi ${user.name},`,
      "Use the button below to choose a new password. The link is valid for 30 minutes and can be used once.",
      "If you did not ask for this, you can ignore this email — nothing has changed.",
    ],
    cta: { label: "Choose a new password", href: `${siteUrl()}/reset-password?token=${raw}` },
  });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) throw validation("That reset link is invalid or has expired. Request a new one.");
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      // Invalidates every existing session for this account.
      credentialsSetAt: new Date(),
      // Anyone holding the mailbox has proven ownership of the address.
      emailVerifiedAt: new Date(),
    },
  });
  await revokeOtherSessions(user.id);
  await recordAudit({
    actorId: user.id,
    action: "user.password_reset",
    entityType: "User",
    entityId: user.id,
  });
  return user;
}

export async function changePassword(
  actor: SessionUser,
  input: { currentPassword: string; password: string },
) {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw notFound("User");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw validation("Your current password is incorrect.");
  }
  if (await verifyPassword(input.password, user.passwordHash)) {
    throw conflict("Choose a password you have not used here before.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password), credentialsSetAt: new Date() },
  });
  // Keep the current device signed in, drop every other one.
  await revokeOtherSessions(user.id, actor.sessionId);
  await recordAudit({
    actorId: user.id,
    action: "user.password_changed",
    entityType: "User",
    entityId: user.id,
  });
}

/* -------------------------------- devices -------------------------------- */

export function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });
}

export async function revokeSession(actor: SessionUser, sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== actor.id) throw notFound("Session");
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await recordAudit({
    actorId: actor.id,
    action: "session.revoked",
    entityType: "Session",
    entityId: session.id,
  });
}

export async function revokeAllOtherSessions(actor: SessionUser) {
  const { count } = await revokeOtherSessions(actor.id, actor.sessionId);
  await recordAudit({
    actorId: actor.id,
    action: "session.revoked_all",
    entityType: "User",
    entityId: actor.id,
    after: { revoked: count },
  });
  return count;
}

/* ----------------------------- notifications ----------------------------- */

export async function updateNotificationPreferences(
  actor: SessionUser,
  prefs: { notifyOnDecision: boolean; notifyOnReply: boolean; notifyDigest: boolean },
) {
  await prisma.user.update({ where: { id: actor.id }, data: prefs });
}

/* ------------------------- erasure and data export ----------------------- */

/**
 * Deleting the row would take the contributed papers with it, and the archive
 * is the whole point of the service. So erasure is an anonymisation: every
 * identifying field is overwritten in place, all credentials and sessions are
 * destroyed, and the papers stay published under an anonymous author.
 *
 * Documented in the privacy policy — keep the two in step.
 */
export async function eraseAccount(actor: SessionUser, currentPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw notFound("User");
  if (user.anonymizedAt) throw conflict("This account has already been erased.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw validation("Your password is incorrect.");
  }
  // A platform admin erasing themselves could lock everyone out of moderation.
  if (user.role === "PLATFORM_ADMIN") {
    const remaining = await prisma.user.count({
      where: { role: "PLATFORM_ADMIN", anonymizedAt: null, id: { not: user.id } },
    });
    if (remaining === 0) {
      throw conflict(
        "You are the last platform admin. Promote someone else before erasing this account.",
      );
    }
  }

  // Private files are removed from storage once the rows are gone.
  const [teacherDocs, ticketFiles] = await Promise.all([
    prisma.teacherVerificationDocument.findMany({
      where: { request: { userId: user.id }, deletedAt: null },
      select: { storageKey: true },
    }),
    prisma.ticketAttachment.findMany({
      where: { ticket: { requesterId: user.id } },
      select: { storageKey: true },
    }),
  ]);

  const now = new Date();
  // Unique but meaningless, and in a reserved TLD so it can never be delivered.
  const placeholder = `erased-${user.id}@deleted.invalid`;
  // Not a hash of anything: no password can ever match it again.
  const unusable = `erased:${randomBytes(32).toString("hex")}`;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: placeholder,
        name: "Deleted account",
        passwordHash: unusable,
        collegeId: null,
        role: "STUDENT",
        teacherVerifiedAt: null,
        trustLevel: "NEW",
        totpSecret: null,
        totpConfirmedAt: null,
        totpRecovery: null,
        emailVerifiedAt: null,
        notifyOnDecision: false,
        notifyOnReply: false,
        notifyDigest: false,
        anonymizedAt: now,
        // Rejects any session token minted before this instant.
        credentialsSetAt: now,
      },
    });
    // Anything that is purely personal goes for good.
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.authToken.deleteMany({ where: { userId: user.id } });
    await tx.inboxMessage.deleteMany({ where: { userId: user.id } });
    await tx.bookmark.deleteMany({ where: { userId: user.id } });
    await tx.userPinnedCollege.deleteMany({ where: { userId: user.id } });
    await tx.paperView.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { toUserId: user.id } });
    // Teacher verification requests and support tickets hold personal details
    // (and documents); messages, events and attachments cascade with them.
    await tx.teacherVerificationRequest.deleteMany({ where: { userId: user.id } });
    await tx.supportTicket.deleteMany({ where: { requesterId: user.id } });
    // Comment rows stay so threads keep their shape, but the text was written
    // by this person and counts as their data, so it is withdrawn.
    await tx.comment.updateMany({
      where: { authorId: user.id, status: { not: "REMOVED" } },
      data: { status: "REMOVED", body: "[withdrawn by the author]", removedReason: "Account erased" },
    });
  });

  for (const { storageKey } of [...teacherDocs, ...ticketFiles]) {
    await storage()
      .delete(storageKey)
      .catch((err) => logger.error("erase_file_failed", { userId: user.id, error: String(err) }));
  }

  await recordAudit({
    actorId: null,
    action: "user.erased",
    entityType: "User",
    entityId: user.id,
    after: { anonymizedAt: now.toISOString() },
  });
  logger.info("account_erased", { userId: user.id });
  return { erasedAt: now };
}

/**
 * Right of access, served as one JSON file. Only ever returns the caller's own
 * rows, and never a password hash, TOTP secret or session token.
 */
export async function exportAccountData(actor: SessionUser) {
  const [
    user,
    papers,
    comments,
    bookmarks,
    requests,
    reports,
    sessions,
    inbox,
    pinnedColleges,
    tickets,
    teacherVerifications,
    memberReports,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        trustLevel: true,
        collegeId: true,
        createdAt: true,
        emailVerifiedAt: true,
        notifyOnDecision: true,
        notifyOnReply: true,
        notifyDigest: true,
        totpConfirmedAt: true,
        status: true,
        statusReason: true,
        statusUntil: true,
        teacherVerifiedAt: true,
      },
    }),
    prisma.paper.findMany({
      where: { uploadedById: actor.id },
      select: { id: true, title: true, status: true, createdAt: true, reviewNote: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.comment.findMany({
      where: { authorId: actor.id },
      select: { id: true, paperId: true, body: true, status: true, createdAt: true, editedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bookmark.findMany({
      where: { userId: actor.id },
      select: { paperId: true, createdAt: true },
    }),
    prisma.paperRequest.findMany({
      where: { requestedById: actor.id },
      select: { id: true, subjectId: true, academicYear: true, fulfilled: true, createdAt: true },
    }),
    prisma.report.findMany({
      where: { reportedById: actor.id },
      select: { id: true, paperId: true, reason: true, details: true, status: true, createdAt: true },
    }),
    prisma.session.findMany({
      where: { userId: actor.id },
      select: { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true },
    }),
    prisma.inboxMessage.findMany({
      where: { userId: actor.id },
      select: { id: true, type: true, title: true, body: true, createdAt: true, readAt: true },
    }),
    prisma.userPinnedCollege.findMany({
      where: { userId: actor.id },
      select: { createdAt: true, college: { select: { id: true, slug: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.supportTicket.findMany({
      where: { requesterId: actor.id },
      orderBy: { createdAt: "asc" },
      select: {
        number: true,
        category: true,
        subject: true,
        status: true,
        createdAt: true,
        // Staff-only internal notes are not the member's data and are excluded.
        messages: {
          where: { internal: false },
          orderBy: { createdAt: "asc" },
          select: { body: true, createdAt: true, authorId: true, attachments: { select: { originalName: true } } },
        },
      },
    }),
    prisma.teacherVerificationRequest.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "asc" },
      select: {
        status: true,
        fullName: true,
        institutionName: true,
        university: true,
        department: true,
        designation: true,
        subjectsTaught: true,
        institutionalEmail: true,
        employeeId: true,
        verificationNotes: true,
        infoRequested: true,
        rejectionReason: true,
        revokeReason: true,
        createdAt: true,
        reviewedAt: true,
        documents: { select: { originalFilename: true, uploadedAt: true, retentionStatus: true, deletedAt: true } },
      },
    }),
    prisma.userReport.findMany({
      where: { reportedById: actor.id },
      select: { reportedUserId: true, reason: true, details: true, status: true, createdAt: true },
    }),
  ]);

  await recordAudit({
    actorId: actor.id,
    action: "user.data_exported",
    entityType: "User",
    entityId: actor.id,
  });

  return {
    exportedAt: new Date().toISOString(),
    format: "papervault.account-export.v1",
    notes:
      "Password hashes, two-factor secrets and session tokens are deliberately excluded. " +
      "Papers you uploaded are listed here but stay in the public archive.",
    account: user,
    papersUploaded: papers,
    comments,
    bookmarks,
    pinnedColleges,
    paperRequests: requests,
    reports,
    sessions,
    inbox,
    supportTickets: tickets.map((t) => ({
      ...t,
      messages: t.messages.map((m) => ({
        from: m.authorId === actor.id ? "you" : "PaperVault team",
        body: m.body,
        createdAt: m.createdAt,
        attachments: m.attachments.map((a) => a.originalName),
      })),
    })),
    teacherVerifications,
    memberReportsFiled: memberReports,
  };
}
