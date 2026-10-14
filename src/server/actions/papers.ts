"use server";

import { revalidatePath } from "next/cache";
import { assertVerifiedEmail, requireUser } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { uploadMetadataSchema, reportSchema, bookmarkSchema, paperRequestSchema } from "../validators";
import { uploadFileFromForm } from "../services/upload-input";
import { catalogueDraftSchema } from "../services/automatic-catalogue";
import { validation } from "@/lib/errors";
import { submitPaper } from "../services/uploads";
import { toggleBookmark } from "../services/library";
import { fileReport } from "../services/reports";
import { requestPaper } from "../services/requests";
import { run, zodErrors, type ActionState } from "./types";

export async function uploadPaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertVerifiedEmail(user);
    await rateLimitAsync(`upload:${user.id}`, 20, 60 * 60_000);

    const file = await uploadFileFromForm(formData, user.name);
    const entries = Object.fromEntries(formData) as Record<string, unknown>;
    let autoCatalogue;
    if (entries.autoCatalogue) {
      if (entries.catalogueConfirmed !== "yes") throw validation("Confirm the detected group before submitting.");
      let raw: unknown;
      try { raw = JSON.parse(String(entries.autoCatalogue)); } catch { throw validation("The automatic group could not be read."); }
      const draft = catalogueDraftSchema.safeParse(raw);
      if (!draft.success) throw validation("Complete the college, programme, branch, semester, subject name/code and exam type before submitting.");
      autoCatalogue = draft.data;
      await rateLimitAsync(`auto-group:${user.id}`, 10, 60 * 60_000);
      // IDs are resolved atomically, never accepted from an unvalidated draft.
      for (const key of ["collegeId", "programId", "branchId", "semesterId", "subjectId", "examTypeId"]) entries[key] = "AUTO";
    }
    const parsed = uploadMetadataSchema.safeParse(entries);
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const alsoSubjectIds = autoCatalogue ? [] : formData.getAll("alsoSubjectIds").map(String).filter(Boolean);

    const result = await submitPaper({
      user,
      metadata: {
        ...parsed.data,
        autoCatalogue,
        sessionLabel: parsed.data.sessionLabel || undefined,
        notes: parsed.data.notes || undefined,
        alsoSubjectIds,
      },
      file,
    });

    revalidatePath("/colleges");
    revalidatePath("/subjects");
    revalidatePath("/library");
    revalidatePath("/moderation");
    return {
      ok: true,
      message: "Paper secured. It is queued for moderator review.",
      data: { paperId: result.paperId },
    };
  });
}

export async function toggleBookmarkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = bookmarkSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Invalid paper." };
    const result = await toggleBookmark(user, parsed.data.paperId);
    revalidatePath("/library");
    revalidatePath(`/papers/${parsed.data.paperId}`);
    return { ok: true, message: result.saved ? "Saved to your library." : "Removed from your library." };
  });
}

export async function reportPaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertVerifiedEmail(user);
    await rateLimitAsync(`report:${user.id}`, 10, 60 * 60_000);
    const parsed = reportSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await fileReport(user, {
      paperId: parsed.data.paperId,
      reason: parsed.data.reason,
      details: parsed.data.details || undefined,
    });
    revalidatePath(`/papers/${parsed.data.paperId}`);
    return { ok: true, message: "Report sent to the moderators. Thank you." };
  });
}

export async function requestPaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    await rateLimitAsync(`request:${user.id}`, 30, 60 * 60_000);
    const parsed = paperRequestSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await requestPaper(user, parsed.data);
    return { ok: true, message: "Request recorded. We will notify contributors from your college." };
  });
}
