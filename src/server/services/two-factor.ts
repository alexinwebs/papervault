import { prisma } from "@/lib/db";
import { conflict, forbidden, validation } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rateLimitAsync } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import {
  formatSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  newTotpSecret,
  recoveryHashMatches,
  totpQrDataUrl,
  totpUri,
  verifyTotp,
} from "@/lib/totp";
import type { SessionUser } from "@/lib/auth";
import { recordAudit } from "./audit";
import { sendAccountEmail } from "./notifications";

import { twoFactorRequired } from "@/lib/two-factor-policy";
export { TWO_FACTOR_REQUIRED_ROLES, twoFactorRequired } from "@/lib/two-factor-policy";

/**
 * Creates (or replaces) an unconfirmed secret and returns everything the
 * enrolment screen needs. The secret is not active until confirmTotp succeeds,
 * so an abandoned enrolment leaves the account exactly as it was.
 */
export async function beginTotpEnrollment(actor: SessionUser) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { email: true, totpConfirmedAt: true },
  });
  if (user.totpConfirmedAt) throw conflict("Two-factor authentication is already on.");

  const secret = newTotpSecret();
  await prisma.user.update({
    where: { id: actor.id },
    data: { totpSecret: secret, totpConfirmedAt: null, totpRecovery: null },
  });

  const uri = totpUri(secret, user.email);
  return { secret, formattedSecret: formatSecret(secret), uri, qr: await totpQrDataUrl(uri) };
}

/** Activates 2FA once the user proves the app is set up, and issues recovery codes. */
export async function confirmTotp(actor: SessionUser, token: string) {
  await rateLimitAsync(`totp:confirm:${actor.id}`, 10, 10 * 60_000);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { email: true, totpSecret: true, totpConfirmedAt: true },
  });
  if (user.totpConfirmedAt) throw conflict("Two-factor authentication is already on.");
  if (!user.totpSecret) throw validation("Start the setup again — there is no pending secret.");
  if (!(await verifyTotp(token, user.totpSecret))) {
    throw validation("That code did not match. Check your phone's clock and try the next one.");
  }

  const codes = generateRecoveryCodes();
  await prisma.user.update({
    where: { id: actor.id },
    data: {
      totpConfirmedAt: new Date(),
      totpRecovery: JSON.stringify(codes.map(hashRecoveryCode)),
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: "user.totp_enabled",
    entityType: "User",
    entityId: actor.id,
  });
  await sendAccountEmail({
    to: user.email,
    userId: actor.id,
    type: "account.totp_enabled",
    subject: "[PaperVault] Two-factor authentication is on",
    title: "Two-factor authentication is on",
    lines: [
      "An authenticator app was added to your PaperVault account just now.",
      "If this was not you, reset your password and revoke your other sessions immediately.",
    ],
    cta: { label: "Review your sessions", href: "/settings" },
  });

  // Shown once, never again.
  return codes;
}

/** Turning 2FA off requires the password, so a hijacked session cannot do it. */
export async function disableTotp(actor: SessionUser, password: string) {
  await rateLimitAsync(`totp:disable:${actor.id}`, 5, 10 * 60_000);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { email: true, role: true, passwordHash: true, totpConfirmedAt: true },
  });
  if (!user.totpConfirmedAt) throw conflict("Two-factor authentication is already off.");
  if (twoFactorRequired(user.role)) {
    throw forbidden("Your role requires two-factor authentication. Ask a platform admin first.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw validation("That password is not correct.");
  }

  await prisma.user.update({
    where: { id: actor.id },
    data: { totpSecret: null, totpConfirmedAt: null, totpRecovery: null },
  });
  await recordAudit({
    actorId: actor.id,
    action: "user.totp_disabled",
    entityType: "User",
    entityId: actor.id,
  });
  await sendAccountEmail({
    to: user.email,
    userId: actor.id,
    type: "account.totp_disabled",
    subject: "[PaperVault] Two-factor authentication is off",
    title: "Two-factor authentication is off",
    lines: [
      "Two-factor authentication was switched off for your PaperVault account.",
      "If this was not you, reset your password immediately.",
    ],
  });
}

/**
 * Second step of sign-in. Accepts a six-digit code or an unused recovery code;
 * a used recovery code is burned so it cannot be replayed.
 */
export async function verifySecondFactor(userId: string, token: string) {
  await rateLimitAsync(`totp:verify:${userId}`, 10, 5 * 60_000);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpConfirmedAt: true, totpRecovery: true },
  });
  if (!user?.totpSecret || !user.totpConfirmedAt) return false;

  if (await verifyTotp(token, user.totpSecret)) return true;

  const stored: string[] = user.totpRecovery ? JSON.parse(user.totpRecovery) : [];
  const candidate = hashRecoveryCode(token);
  const index = stored.findIndex((hash) => recoveryHashMatches(candidate, hash));
  if (index === -1) return false;

  stored.splice(index, 1);
  await prisma.user.update({
    where: { id: userId },
    data: { totpRecovery: JSON.stringify(stored) },
  });
  logger.info("totp_recovery_code_used", { userId, remaining: stored.length });
  await recordAudit({
    actorId: userId,
    action: "user.totp_recovery_used",
    entityType: "User",
    entityId: userId,
    after: JSON.stringify({ remaining: stored.length }),
  });
  return true;
}

export async function recoveryCodesRemaining(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpRecovery: true },
  });
  if (!user?.totpRecovery) return 0;
  return (JSON.parse(user.totpRecovery) as string[]).length;
}
