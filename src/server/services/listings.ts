import { prisma, prismaRaw } from "@/lib/db";
import { notFound, validation } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import { assertCollegeScope } from "../authz";
import { recordAudit } from "./audit";

/**
 * Cross-listing: one paper, several branches. A DBMS paper set for CSE is
 * usually the very same paper IT, IoT and DS students sat, so instead of
 * uploading it four times (which the duplicate guard would refuse anyway) the
 * paper keeps its primary placement and gains extra PaperListing rows.
 */
export const MAX_EXTRA_LISTINGS = 20;

type Tx = Pick<typeof prismaRaw, "subject" | "paperListing">;

/** Normalised name used to spot "the same subject" in a sibling branch. */
export function subjectKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Cleans and verifies the extra subject ids a client sent: unique, not the
 * primary subject, live, and inside the same college. Never trust the form.
 */
export async function resolveListingSubjects(
  input: { collegeId: string; primarySubjectId: string; subjectIds: string[] },
  db: Tx = prismaRaw,
) {
  const ids = [...new Set(input.subjectIds.map((id) => id.trim()).filter(Boolean))].filter(
    (id) => id !== input.primarySubjectId,
  );
  if (ids.length === 0) return [];
  if (ids.length > MAX_EXTRA_LISTINGS) {
    throw validation(`A paper can be listed under at most ${MAX_EXTRA_LISTINGS} extra branches.`);
  }
  const found = await db.subject.findMany({
    where: {
      id: { in: ids },
      archived: false,
      semester: { branch: { archived: false, program: { collegeId: input.collegeId } } },
    },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw validation("One of the extra branches isn't part of this college any more. Refresh and try again.");
  }
  return ids;
}

/**
 * Subjects in the same program, other branches, that look like the same
 * subject (same code, or same name ignoring case and punctuation).
 */
export async function siblingSubjects(subjectId: string) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      code: true,
      name: true,
      semester: { select: { branchId: true, branch: { select: { programId: true } } } },
    },
  });
  if (!subject) return [];
  const candidates = await prisma.subject.findMany({
    where: {
      archived: false,
      id: { not: subject.id },
      semester: {
        branchId: { not: subject.semester.branchId },
        branch: { archived: false, programId: subject.semester.branch.programId },
      },
    },
    select: {
      id: true,
      name: true,
      code: true,
      semester: { select: { number: true, branch: { select: { id: true, name: true, code: true } } } },
    },
    orderBy: [{ semester: { branch: { name: "asc" } } }, { semester: { number: "asc" } }],
  });
  const code = subject.code.trim().toLowerCase();
  const key = subjectKey(subject.name);
  return candidates.filter(
    (c) => (code && c.code.trim().toLowerCase() === code) || subjectKey(c.name) === key,
  );
}

/** Moderators (own college) and platform admins can fix a paper's branches later. */
export async function setPaperListings(actor: SessionUser, input: { paperId: string; subjectIds: string[] }) {
  const paper = await prisma.paper.findUnique({
    where: { id: input.paperId },
    select: {
      id: true,
      listings: { select: { subjectId: true } },
      paperSet: {
        select: {
          examSession: {
            select: {
              subjectId: true,
              subject: { select: { semester: { select: { branch: { select: { program: { select: { collegeId: true } } } } } } } },
            },
          },
        },
      },
    },
  });
  if (!paper) throw notFound("Paper not found.");
  const collegeId = paper.paperSet.examSession.subject.semester.branch.program.collegeId;
  assertCollegeScope(actor, collegeId);

  const ids = await resolveListingSubjects({
    collegeId,
    primarySubjectId: paper.paperSet.examSession.subjectId,
    subjectIds: input.subjectIds,
  });
  const before = paper.listings.map((l) => l.subjectId).sort();

  await prismaRaw.$transaction([
    prismaRaw.paperListing.deleteMany({ where: { paperId: paper.id, subjectId: { notIn: ids } } }),
    prismaRaw.paperListing.createMany({
      data: ids.map((subjectId) => ({ paperId: paper.id, subjectId })),
      skipDuplicates: true,
    }),
  ]);

  await recordAudit({
    actorId: actor.id,
    action: "paper.listings_updated",
    entityType: "Paper",
    entityId: paper.id,
    before: { subjects: before },
    after: { subjects: [...ids].sort() },
  });
  return ids;
}

/** Where-clause: papers placed under this subject, primarily or as an extra listing. */
export function underSubject(subjectId: string, examTypeCode?: string) {
  const examFilter = examTypeCode ? { examType: { code: examTypeCode } } : {};
  return {
    OR: [
      { paperSet: { examSession: { subjectId, ...examFilter } } },
      { listings: { some: { subjectId } }, paperSet: { examSession: examFilter } },
    ],
  };
}
