"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { assertCanModerate } from "../authz";
import { takedownResolveSchema, takedownSchema } from "../validators";
import { fileTakedown, resolveTakedown } from "../services/takedowns";
import { run, zodErrors, type ActionState } from "./types";

export async function fileTakedownAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const parsed = takedownSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const request = await fileTakedown({
      ...parsed.data,
      statementSigned: Boolean(parsed.data.statementSigned),
      requestIp: await clientIp(),
    });
    return {
      ok: true,
      message: `Notice received. Your reference is ${request.id.slice(-8).toUpperCase()} — we have emailed you a copy.`,
    };
  });
}

export async function resolveTakedownAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertCanModerate(user);
    const parsed = takedownResolveSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await resolveTakedown(user, parsed.data);
    revalidatePath("/moderation/takedowns");
    return { ok: true, message: "Recorded." };
  });
}
