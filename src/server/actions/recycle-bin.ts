"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { paperDeleteSchema, paperIdSchema } from "../validators";
import { purgePaper, restorePaper, softDeletePaper } from "../services/recycle-bin";
import { run, zodErrors, type ActionState } from "./types";

export async function softDeletePaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = paperDeleteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await softDeletePaper(user, parsed.data);
    revalidatePath("/moderation");
    // The paper page this was triggered from no longer resolves.
    redirect("/moderation/recycle-bin?done=deleted");
  });
}

export async function restorePaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = paperIdSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await restorePaper(user, parsed.data);
    revalidatePath("/moderation");
    redirect("/moderation/recycle-bin?done=restored");
  });
}

export async function purgePaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = paperIdSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await purgePaper(user, parsed.data);
    redirect("/moderation/recycle-bin?done=purged");
  });
}
