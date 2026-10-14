import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { textKey } from "@/lib/paper-detection";
import { slugify } from "@/lib/utils";
import { validation } from "@/lib/errors";
import { branchCodeFromName, branchInputMatchesExisting } from "@/lib/upload-details";

export const catalogueDraftSchema = z.object({
  collegeName: z.string().trim().min(3).max(180),
  university: z.string().trim().max(180).optional(),
  programName: z.enum(["B.Tech", "M.Tech", "BCA", "MCA", "BBA", "MBA"]),
  branchName: z.string().trim().min(2).max(120),
  branchCode: z.string().trim().max(16).regex(/^[a-zA-Z0-9 -]*$/).optional().default(""),
  semesterNumber: z.coerce.number().int().min(1).max(12),
  subjectName: z.string().trim().min(2).max(180),
  subjectCode: z.string().trim().min(2).max(24).regex(/^[a-zA-Z0-9 -]+$/),
  examCode: z.enum(["CT", "ST", "PUT", "MID_SEM", "END_SEM"]),
}).transform((draft) => ({ ...draft, branchCode: draft.branchCode || branchCodeFromName(draft.branchName) }))
  .refine((draft) => draft.branchCode.length >= 2, { message: "Enter a branch name or a branch code with at least two characters.", path: ["branchName"] });
export type AutomaticCatalogue = z.infer<typeof catalogueDraftSchema>;

/** Must run inside the upload transaction: rejection rolls back ALL new groups. */
export async function resolveAutomaticCatalogue(tx: Prisma.TransactionClient, input: AutomaticCatalogue, actorId: string) {
  const draft = catalogueDraftSchema.parse(input);
  const colleges = await tx.college.findMany({ select: { id: true, name: true, shortName: true, slug: true } });
  const matched = colleges.filter((c) => textKey(c.name) === textKey(draft.collegeName) || textKey(c.shortName) === textKey(draft.collegeName));
  if (matched.length > 1) throw validation("Several colleges use that abbreviation. Enter the full college name.");
  const created: Array<{ type: string; id: string }> = [];
  let college = matched.length === 1 ? await tx.college.findUniqueOrThrow({ where: { id: matched[0].id } }) : null;
  if (!college) {
    const slug = slugify(draft.collegeName);
    if (!slug || colleges.some((c) => c.slug === slug)) throw validation("That college name conflicts with an existing group. Select the existing college or enter its full name.");
    college = await tx.college.create({ data: { name: draft.collegeName, slug,
      shortName: draft.collegeName.split(/\s+/).filter((s) => !/^(of|and|the|for)$/i.test(s)).map((s) => s[0]).join("").slice(0, 16) || "NEW",
      city: "Not specified", state: "Not specified", university: draft.university || "Not specified",
      about: "Automatically grouped from a user-confirmed paper. This institution has not been verified by staff.", verified: false } });
    created.push({ type: "College", id: college.id });
  }
  let program = (await tx.program.findMany({ where: { collegeId: college.id } })).find((p) => textKey(p.name) === textKey(draft.programName));
  if (program?.archived) throw validation("That programme is archived. Ask a moderator to restore it.");
  if (!program) {
    program = await tx.program.create({ data: { collegeId: college.id, slug: textKey(draft.programName), name: draft.programName, level: /^(M)/.test(draft.programName) ? "PG" : "UG", semesterCount: draft.programName === "B.Tech" ? 8 : draft.programName === "BCA" || draft.programName === "BBA" ? 6 : 4 } });
    created.push({ type: "Program", id: program.id });
  }
  const branchMatches = (await tx.branch.findMany({ where: { programId: program.id } })).filter((b) => textKey(b.code) === textKey(draft.branchCode) || textKey(b.name) === textKey(draft.branchName));
  if (branchMatches.length > 1) throw validation("The branch name and code match different catalogue entries. Select the correct primary branch.");
  let branch = branchMatches[0];
  if (branch && !branchInputMatchesExisting(draft, branch)) throw validation(`Branch code ${draft.branchCode} already belongs to ${branch.name}. Choose that branch or edit the code under More details.`);
  if (branch?.archived) throw validation("That branch is archived. Ask a moderator to restore it.");
  if (!branch) {
    branch = await tx.branch.create({ data: { programId: program.id, slug: slugify(draft.branchCode), name: draft.branchName, code: draft.branchCode.toUpperCase() } });
    created.push({ type: "Branch", id: branch.id });
  }
  const existingSemester = await tx.semester.findUnique({ where: { branchId_number: { branchId: branch.id, number: draft.semesterNumber } } });
  const semester = await tx.semester.upsert({ where: { branchId_number: { branchId: branch.id, number: draft.semesterNumber } }, create: { branchId: branch.id, number: draft.semesterNumber }, update: {} });
  if (!existingSemester) created.push({ type: "Semester", id: semester.id });
  if (program.semesterCount < draft.semesterNumber) await tx.program.update({ where: { id: program.id }, data: { semesterCount: draft.semesterNumber } });
  const subjects = await tx.subject.findMany({ where: { semesterId: semester.id } });
  let subject = subjects.find((s) => textKey(s.code) === textKey(draft.subjectCode));
  if (subject && textKey(subject.name) !== textKey(draft.subjectName)) throw validation(`Subject code ${draft.subjectCode} already belongs to ${subject.name}. Confirm the name instead of creating a conflicting subject.`);
  if (subject?.archived) throw validation("That subject is archived. Ask a moderator to restore it.");
  if (!subject) {
    const baseSlug = slugify(draft.subjectName) || slugify(draft.subjectCode);
    const slug = subjects.some((s) => s.slug === baseSlug || textKey(s.name) === textKey(draft.subjectName)) ? `${baseSlug}-${slugify(draft.subjectCode)}` : baseSlug;
    subject = await tx.subject.create({ data: { semesterId: semester.id, name: draft.subjectName, code: draft.subjectCode.toUpperCase(), slug } });
    created.push({ type: "Subject", id: subject.id });
  }
  const existingExam = await tx.examType.findUnique({ where: { collegeId_code: { collegeId: college.id, code: draft.examCode } } });
  const examType = await tx.examType.upsert({ where: { collegeId_code: { collegeId: college.id, code: draft.examCode } }, create: { collegeId: college.id, code: draft.examCode, name: draft.examCode.replace(/_/g, "-"), sortOrder: 5 }, update: {} });
  if (!existingExam) created.push({ type: "ExamType", id: examType.id });
  for (const item of created) await tx.auditLog.create({ data: { actorId, action: "catalogue.auto_created", entityType: item.type, entityId: item.id, after: JSON.stringify({ ...draft, source: "confirmed_upload" }) } });
  const full = await tx.subject.findUniqueOrThrow({ where: { id: subject.id }, include: { semester: { include: { branch: { include: { program: { include: { college: true } } } } } } } });
  return { subject: full, examType, college };
}
