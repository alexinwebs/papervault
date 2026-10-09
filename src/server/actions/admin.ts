"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, type SessionUser } from "@/lib/auth";
import { forbidden } from "@/lib/errors";
import { assertPlatformAdmin } from "../authz";
import { safeLocalPath } from "@/lib/utils";
import {
  applyCurriculumSchema,
  branchInputSchema,
  branchUpdateSchema,
  collegeInputSchema,
  collegeUpdateSchema,
  deleteEntitySchema,
  examTypeInputSchema,
  examTypeUpdateSchema,
  memberActionSchema,
  memberCreateSchema,
  memberUpdateSchema,
  paperAdminSchema,
  programInputSchema,
  programUpdateSchema,
  semesterInputSchema,
  subjectImportSchema,
  subjectInputSchema,
  subjectUpdateSchema,
} from "../validators";
import {
  applyCurriculumTemplate,
  createBranch,
  createCollege,
  createExamType,
  createMember,
  createProgram,
  createSemester,
  createSubject,
  deleteEntity,
  importSubjects,
  memberAction,
  setPaperStatusAdmin,
  updateBranch,
  updateCollege,
  updateExamType,
  updateMember,
  updateProgram,
  updateSubject,
} from "../services/admin";
import { run, zodErrors, type ActionState } from "./types";

async function requireAdmin(): Promise<SessionUser> {
  const actor = await requireUser();
  assertPlatformAdmin(actor);
  return actor;
}

/** Admin edits change navigation everywhere, so refresh the shared routes. */
/**
 * Returns the caller's page so a mutation can end in a navigation. Server
 * actions that replace the form they were submitted from leave the pending
 * state stuck if they only revalidate, so the admin mutations redirect.
 */
function returnTo(formData: FormData, fallback: string) {
  const value = String(formData.get("returnTo") ?? "");
  return safeLocalPath(value, fallback);
}

/**
 * `except` skips one path. Revalidating the very route an action then
 * redirects to makes the client router apply an empty segment, so the flash
 * page renders blank until a manual reload. These admin screens are all
 * server-rendered on demand, so skipping the redirect target costs nothing.
 */
function revalidateAcademics(collegeId?: string, except?: string) {
  const paths = ["/", "/admin", "/admin/colleges", "/programs", "/subjects", "/upload"];
  if (collegeId) paths.push(`/admin/colleges/${collegeId}`);
  for (const path of paths) if (path !== except) revalidatePath(path);
}

export async function createCollegeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = collegeInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const college = await createCollege(actor, parsed.data);
    revalidateAcademics(college.id, "/admin/colleges");
    redirect(`/admin/colleges?added=${encodeURIComponent(college.shortName)}`);
  });
}

export async function updateCollegeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = collegeUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const college = await updateCollege(actor, parsed.data);
    revalidateAcademics(college.id);
    revalidatePath(`/colleges/${college.slug}`);
    return { ok: true, message: `${college.shortName} updated.` };
  });
}

export async function createProgramAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = programInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const program = await createProgram(actor, parsed.data);
    revalidateAcademics(parsed.data.collegeId);
    return { ok: true, message: `${program.name} added.` };
  });
}

export async function createBranchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = branchInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const branch = await createBranch(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    return { ok: true, message: `${branch.code} added with semesters.` };
  });
}

export async function createSemesterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = semesterInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const semester = await createSemester(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    return { ok: true, message: `Semester ${semester.number} added.` };
  });
}

export async function createSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = subjectInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const subject = await createSubject(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    return { ok: true, message: `${subject.code} — ${subject.name} added.` };
  });
}

export async function createExamTypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = examTypeInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const examType = await createExamType(actor, parsed.data);
    revalidateAcademics(parsed.data.collegeId);
    return { ok: true, message: `${examType.name} added.` };
  });
}

export async function deleteEntityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = deleteEntitySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const result = await deleteEntity(actor, parsed.data);
    const target = returnTo(formData, "/admin");
    revalidateAcademics(String(formData.get("collegeId") ?? ""), target);
    revalidatePath("/admin/papers");
    revalidatePath("/admin/users");
    revalidatePath("/moderation");
    redirect(`${target}${target.includes("?") ? "&" : "?"}deleted=${encodeURIComponent(result?.message ?? "Deleted.")}`);
  });
}

export async function adminPaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = paperAdminSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const paper = await setPaperStatusAdmin(actor, parsed.data);
    // Not revalidating /admin/papers: see revalidateAcademics above.
    revalidatePath(`/papers/${paper.id}`);
    // Same reason as the moderation action: revalidating this route remounts
    // the form, so the outcome is carried in the URL instead.
    redirect(`/admin/papers?done=${encodeURIComponent(`Paper is now ${paper.status.replace(/_/g, " ").toLowerCase()}.`)}`);
  });
}

/* ------------------------- taxonomy edits -------------------------------- */

export async function updateProgramAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = programUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const program = await updateProgram(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    return { ok: true, message: `${program.name} saved.` };
  });
}

export async function updateBranchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = branchUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const branch = await updateBranch(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    revalidatePath(`/admin/branches/${branch.id}`);
    return { ok: true, message: `${branch.code} saved.` };
  });
}

export async function updateSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = subjectUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const subject = await updateSubject(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    return { ok: true, message: `${subject.code} saved.` };
  });
}

export async function updateExamTypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = examTypeUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const examType = await updateExamType(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    return { ok: true, message: `${examType.code} saved.` };
  });
}

/* --------------------- bulk import and templates ------------------------- */

export async function importSubjectsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = subjectImportSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const result = await importSubjects(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    const parts = [`${result.created} added`];
    if (result.updated) parts.push(`${result.updated} renamed`);
    if (result.rejected.length) parts.push(`${result.rejected.length} line(s) skipped`);
    // The form is replaced by the revalidation, so the outcome rides the URL.
    redirect(
      `/admin/branches/${parsed.data.branchId}?done=${encodeURIComponent(`Import finished: ${parts.join(", ")}.`)}`,
    );
  });
}

export async function applyCurriculumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = applyCurriculumSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const result = await applyCurriculumTemplate(actor, parsed.data);
    revalidateAcademics(String(formData.get("collegeId") ?? ""));
    redirect(
      `/admin/branches/${parsed.data.branchId}?done=${encodeURIComponent(
        result.created + result.updated === 0
          ? "Already up to date with the catalogue."
          : `Catalogue applied: ${result.created} added, ${result.updated} renamed.`,
      )}`,
    );
  });
}

/* --------------------------- member management --------------------------- */

export async function createMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = memberCreateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const user = await createMember(actor, parsed.data);
    revalidatePath("/admin/users");
    redirect(`/admin/users/${user.id}?done=${encodeURIComponent(`${user.name} created.`)}`);
  });
}

export async function updateMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = memberUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const user = await updateMember(actor, parsed.data);
    revalidatePath("/admin/users");
    return { ok: true, message: `${user.name} saved.` };
  });
}

export async function memberActionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = memberActionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const result = await memberAction(actor, parsed.data);
    revalidatePath("/admin/users");
    redirect(`/admin/users/${parsed.data.userId}?done=${encodeURIComponent(result.message)}`);
  });
}
