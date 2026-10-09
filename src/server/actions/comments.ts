"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  commentEditSchema,
  commentInputSchema,
  commentRemoveSchema,
  commentReportSchema,
} from "../validators";
import { addComment, editComment, removeComment, reportComment } from "../services/comments";
import { run, zodErrors, type ActionState } from "./types";

/**
 * Edit and remove replace the comment node that owns the submitting form. A
 * revalidate alone unmounts that form mid-transition and the pending state
 * never clears, so those actions navigate instead.
 */
function paperPath(formData: FormData) {
  return `/papers/${encodeURIComponent(String(formData.get("paperId") ?? ""))}`;
}

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = commentInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await addComment(user, {
      paperId: parsed.data.paperId,
      parentId: parsed.data.parentId || null,
      body: parsed.data.body,
    });
    revalidatePath(`/papers/${parsed.data.paperId}`);
    return { ok: true, message: "Posted." };
  });
}

export async function editCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = commentEditSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await editComment(user, parsed.data);
    redirect(`${paperPath(formData)}?comment=updated`);
  });
}

export async function removeCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = commentRemoveSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await removeComment(user, { commentId: parsed.data.commentId, reason: parsed.data.reason });
    revalidatePath("/moderation");
    redirect(`${paperPath(formData)}?comment=removed`);
  });
}

export async function reportCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = commentReportSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await reportComment(user, {
      commentId: parsed.data.commentId,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });
    revalidatePath("/moderation");
    return { ok: true, message: "Reported. A moderator will take a look." };
  });
}
