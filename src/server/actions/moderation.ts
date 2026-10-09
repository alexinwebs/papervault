"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertCanModerate, assertPlatformAdmin } from "../authz";
import { moderationDecisionSchema, resolveReportSchema, updateRoleSchema } from "../validators";
import { decide, resolveReport } from "../services/moderation";
import { changeRole } from "../services/admin";
import { run, zodErrors, type ActionState } from "./types";

export async function moderateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertCanModerate(user);
    const parsed = moderationDecisionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const paper = await decide(user, parsed.data);
    revalidatePath("/moderation");
    revalidatePath(`/papers/${parsed.data.paperId}`);
    // Redirect instead of returning state: revalidating this route remounts the
    // form, which would wipe a client-held success message before it is read.
    redirect(`/moderation/${parsed.data.paperId}?decided=${paper.status}`);
  });
}

export async function resolveReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertCanModerate(user);
    const parsed = resolveReportSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Invalid report action." };
    await resolveReport(user, parsed.data);
    revalidatePath("/moderation");
    return { ok: true, message: "Report closed." };
  });
}

export async function updateRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    assertPlatformAdmin(actor);
    const parsed = updateRoleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const after = await changeRole(actor, parsed.data);
    revalidatePath("/admin");
    return { ok: true, message: `${after.name} is now ${after.role.replace(/_/g, " ").toLowerCase()}.` };
  });
}
