"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { TEACHER_DOC_MAX_FILES } from "@/lib/constants";
import { teacherApplicationSchema, teacherDecisionSchema, teacherInfoSchema } from "../validators";
import {
  addTeacherVerificationNote,
  approveTeacherVerification,
  cancelTeacherVerification,
  deleteTeacherDocumentsNow,
  provideMoreInformation,
  rejectTeacherVerification,
  requestMoreInformation,
  revokeTeacherVerification,
  startReview,
  submitTeacherVerification,
} from "../services/teacher-verification";
import { filesFrom } from "../services/private-files";
import { run, zodErrors, type ActionState } from "./types";

export async function submitTeacherVerificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const fields = Object.fromEntries(
      [...formData.entries()].filter(([, v]) => typeof v === "string"),
    );
    const parsed = teacherApplicationSchema.safeParse(fields);
    if (!parsed.success) {
      return { ok: false, message: "Check the highlighted fields.", fieldErrors: zodErrors(parsed.error) };
    }
    const files = await filesFrom(formData, "documents", TEACHER_DOC_MAX_FILES);
    const { attest: _attest, ...application } = parsed.data;
    await submitTeacherVerification(user, application, files, await clientIp());
    revalidatePath("/teacher-verification");
    return { ok: true, message: "Verification submitted. We'll let you know when it has been reviewed." };
  });
}

export async function provideTeacherInfoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = teacherInfoSchema.safeParse({
      requestId: formData.get("requestId"),
      notes: formData.get("notes") ?? "",
    });
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const files = await filesFrom(formData, "documents", TEACHER_DOC_MAX_FILES);
    await provideMoreInformation(user, parsed.data, files);
    revalidatePath("/teacher-verification");
    return { ok: true, message: "Thanks — your request is back with the reviewer." };
  });
}

export async function cancelTeacherVerificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const requestId = String(formData.get("requestId") ?? "");
    await cancelTeacherVerification(user, requestId);
    revalidatePath("/teacher-verification");
    return { ok: true, message: "Request withdrawn." };
  });
}

const DONE: Record<string, string> = {
  START_REVIEW: "Marked as under review.",
  APPROVE: "Approved. The member now has the teacher role.",
  REJECT: "Rejected. The applicant has been told why.",
  REQUEST_INFO: "Information requested from the applicant.",
  NOTE: "Note added.",
  REVOKE: "Verification revoked and the teacher role removed.",
  DELETE_DOCUMENTS: "Documents securely deleted.",
};

/** Every admin decision goes through here; the service re-checks the role and 2FA. */
export async function teacherDecisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    const parsed = teacherDecisionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Check the form.", fieldErrors: zodErrors(parsed.error) };
    const input = parsed.data;
    switch (input.decision) {
      case "START_REVIEW":
        await startReview(actor, input.requestId);
        break;
      case "APPROVE":
        await approveTeacherVerification(actor, {
          requestId: input.requestId,
          confirm: input.confirm,
          note: input.note || null,
        });
        break;
      case "REJECT":
        await rejectTeacherVerification(actor, {
          requestId: input.requestId,
          reason: input.reason,
          internalNote: input.internalNote || null,
        });
        break;
      case "REQUEST_INFO":
        await requestMoreInformation(actor, { requestId: input.requestId, message: input.message });
        break;
      case "NOTE":
        await addTeacherVerificationNote(actor, { requestId: input.requestId, note: input.note });
        break;
      case "REVOKE":
        await revokeTeacherVerification(actor, { requestId: input.requestId, reason: input.reason });
        break;
      case "DELETE_DOCUMENTS":
        await deleteTeacherDocumentsNow(actor, input.requestId);
        break;
    }
    revalidatePath(`/admin/teacher-verifications/${input.requestId}`);
    revalidatePath("/admin/teacher-verifications");
    return { ok: true, message: DONE[input.decision] };
  });
}
