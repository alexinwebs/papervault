"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  requireUser,
  startTwoFactorChallenge,
  isSuspended,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimitAsync } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { safeLocalPath } from "@/lib/utils";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  notificationPrefsSchema,
  registerSchema,
  resetPasswordSchema,
  revokeSessionSchema,
  settingsSchema,
  eraseAccountSchema,
} from "../validators";
import { recordAudit } from "../services/audit";
import {
  changePassword,
  requestPasswordReset,
  resetPassword,
  revokeAllOtherSessions,
  revokeSession,
  sendVerificationEmail,
  updateNotificationPreferences,
  eraseAccount,
} from "../services/account";
import { logger } from "@/lib/logger";
import { run, zodErrors, type ActionState } from "./types";

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const parsed = registerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await rateLimitAsync(`register:${parsed.data.email}`, 5, 60_000);
    // Per address rather than one global bucket: a global cap let a single
    // client exhaust sign-ups for everyone.
    const ip = await clientIp();
    // 60/hour lets a whole class sign up together from one campus network.
    const perIp = Number(process.env.REGISTRATIONS_PER_IP_PER_HOUR) || 60;
    if (ip) await rateLimitAsync(`register:ip:${ip}`, perIp, 60 * 60_000);

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return { ok: false, fieldErrors: { email: "An account with this email already exists." } };
    }
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
        collegeId: parsed.data.collegeId ?? null,
      },
    });
    await createSession(user.id);
    await recordAudit({ actorId: user.id, action: "user.registered", entityType: "User", entityId: user.id });
    // Delivery problems must not block the sign-up itself.
    try {
      await sendVerificationEmail(user.id);
    } catch (err) {
      logger.error("verification_email_failed", { error: String(err) });
    }
    redirect("/verify-email?sent=1");
  });
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const parsed = loginSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    // Per account, not per IP, so one attacker cannot lock a campus out.
    // Raise LOGIN_ATTEMPTS_PER_MINUTE only for automated runs that sign the
    // same seeded account in dozens of times a minute.
    const attempts = Number(process.env.LOGIN_ATTEMPTS_PER_MINUTE) || 10;
    await rateLimitAsync(`login:${parsed.data.email}`, attempts, 60_000);
    // A looser per-address cap stops one client spraying many accounts while
    // still letting a campus behind one NAT sign in normally.
    const ip = await clientIp();
    if (ip) await rateLimitAsync(`login:ip:${ip}`, Math.max(attempts * 6, 60), 60_000);

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!user || !valid) {
      return { ok: false, message: "Email or password is incorrect." };
    }
    if (user.anonymizedAt) {
      // Belt and braces: the placeholder hash can never match anyway.
      return { ok: false, message: "Email or password is incorrect." };
    }
    if (user.bannedAt || user.status === "BANNED") {
      return { ok: false, message: "This account has been banned. If you think this is a mistake, email the address on the Contact page." };
    }
    if (isSuspended(user)) {
      const until = user.statusUntil
        ? ` until ${user.statusUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
        : "";
      return { ok: false, message: `This account is suspended${until}. If you think this is a mistake, email the address on the Contact page.` };
    }

    const requested = String(formData.get("next") ?? "/");
    const next = safeLocalPath(requested);

    // The password is only the first factor when an authenticator is enrolled.
    if (user.totpConfirmedAt) {
      await startTwoFactorChallenge(user.id, next);
      redirect("/login/two-factor");
    }

    await createSession(user.id);
    redirect(next);
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, collegeId: parsed.data.collegeId || null },
    });
    revalidatePath("/settings");
    return { ok: true, message: "Settings saved." };
  });
}


export async function resendVerificationAction(): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    await rateLimitAsync(`verify:${user.id}`, 3, 15 * 60_000);
    const result = await sendVerificationEmail(user.id);
    return {
      ok: true,
      message: result.alreadyVerified
        ? "Your email is already confirmed."
        : "Confirmation link sent. Check your inbox.",
    };
  });
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await rateLimitAsync(`forgot:${parsed.data.email}`, 3, 15 * 60_000);
    const ip = await clientIp();
    if (ip) await rateLimitAsync(`forgot:ip:${ip}`, 10, 15 * 60_000);
    await requestPasswordReset(parsed.data.email);
    // Deliberately identical whether or not the address exists.
    return {
      ok: true,
      message: "If that address has an account, a reset link is on its way. Check your inbox.",
    };
  });
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    // Tokens are 256-bit and single use; this only blunts automated guessing
    // without letting one client block every reset (the old global bucket did).
    const ip = await clientIp();
    if (ip) await rateLimitAsync(`reset:ip:${ip}`, 20, 15 * 60_000);
    const user = await resetPassword(parsed.data.token, parsed.data.password);
    await createSession(user.id);
    redirect("/?reset=1");
  });
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await rateLimitAsync(`change-password:${user.id}`, 5, 15 * 60_000);
    await changePassword(user, parsed.data);
    revalidatePath("/settings");
    return { ok: true, message: "Password changed. Every other device has been signed out." };
  });
}

export async function updateNotificationPrefsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = notificationPrefsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await updateNotificationPreferences(user, {
      notifyOnDecision: Boolean(parsed.data.notifyOnDecision),
      notifyOnReply: Boolean(parsed.data.notifyOnReply),
      notifyDigest: Boolean(parsed.data.notifyDigest),
    });
    revalidatePath("/settings");
    return { ok: true, message: "Email preferences saved." };
  });
}

export async function revokeSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = revokeSessionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await revokeSession(user, parsed.data.sessionId);
    revalidatePath("/settings");
    return { ok: true, message: "That device was signed out." };
  });
}

export async function revokeAllSessionsAction(): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const count = await revokeAllOtherSessions(user);
    revalidatePath("/settings");
    return {
      ok: true,
      message: count === 0 ? "No other devices were signed in." : `Signed out ${count} other device${count === 1 ? "" : "s"}.`,
    };
  });
}

/**
 * Right to erasure. Anonymises the account in place and signs the person out;
 * see eraseAccount() for why the row is not simply deleted.
 *
 * Redirects rather than returning state: the panel holding this form is gone
 * by the time the action resolves.
 */
export async function eraseAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = eraseAccountSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    if (parsed.data.confirm.toUpperCase() !== "ERASE") {
      return { ok: false, fieldErrors: { confirm: 'Type ERASE to confirm.' } };
    }
    await rateLimitAsync(`erase-account:${user.id}`, 3, 60 * 60_000);
    await eraseAccount(user, parsed.data.currentPassword);
    await destroySession();
    redirect("/?erased=1");
  });
}
