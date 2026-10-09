"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearTwoFactorChallenge,
  createSession,
  readTwoFactorChallenge,
  requireUser,
} from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  beginTotpEnrollment,
  confirmTotp,
  disableTotp,
  verifySecondFactor,
} from "../services/two-factor";
import { run, type ActionState } from "./types";

export async function startTotpAction(): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const enrollment = await beginTotpEnrollment(user);
    return { ok: true, data: { ...enrollment } };
  });
}

export async function confirmTotpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const codes = await confirmTotp(user, String(formData.get("token") ?? ""));
    revalidatePath("/settings");
    return {
      ok: true,
      message: "Two-factor authentication is on. Save these recovery codes now.",
      data: { recoveryCodes: codes },
    };
  });
}

export async function disableTotpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    await disableTotp(user, String(formData.get("password") ?? ""));
    revalidatePath("/settings");
    return { ok: true, message: "Two-factor authentication is off." };
  });
}

/** Second step of sign-in. Consumes the pending challenge cookie. */
export async function verifyTwoFactorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const challenge = await readTwoFactorChallenge();
    if (!challenge) {
      return { ok: false, message: "That sign-in attempt expired. Start again." };
    }
    await rateLimitAsync(`2fa:attempt:${challenge.userId}`, 10, 5 * 60_000);

    const token = String(formData.get("token") ?? "").trim();
    if (!(await verifySecondFactor(challenge.userId, token))) {
      return { ok: false, message: "That code is not valid. Try the next one from your app." };
    }

    await clearTwoFactorChallenge();
    await createSession(challenge.userId);
    redirect(challenge.next);
  });
}

export async function cancelTwoFactorAction(): Promise<void> {
  await clearTwoFactorChallenge();
  redirect("/login");
}
