import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, forbidden, notFound, validation } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { storage } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import {
  curriculumFor,
  curriculumKey,
  curriculumRows,
  curriculumSubjectCount,
} from "@/data/curriculum";
import {
  applyCurriculumSchema,
  branchInputSchema,
  branchUpdateSchema,
  examTypeUpdateSchema,
  memberActionSchema,
  memberCreateSchema,
  memberUpdateSchema,
  programUpdateSchema,
  subjectImportSchema,
  subjectUpdateSchema,
  collegeInputSchema,
  collegeUpdateSchema,
  examTypeInputSchema,
  programInputSchema,
  semesterInputSchema,
  subjectInputSchema,
} from "../validators";
import { recordAudit } from "./audit";
import { sendDecisionEmail } from "./moderation";
import { setUserStanding } from "./standing";
import { settleClassificationForRelease } from "./papers";
import type { UserStatus } from "@/lib/constants";

type CollegeInput = z.infer<typeof collegeInputSchema>;
type CollegeUpdate = z.infer<typeof collegeUpdateSchema>;
type ProgramInput = z.infer<typeof programInputSchema>;
type BranchInput = z.infer<typeof branchInputSchema>;
type SemesterInput = z.infer<typeof semesterInputSchema>;
type SubjectInput = z.infer<typeof subjectInputSchema>;
type ExamTypeInput = z.infer<typeof examTypeInputSchema>;
type ProgramUpdate = z.infer<typeof programUpdateSchema>;
type BranchUpdate = z.infer<typeof branchUpdateSchema>;
type SubjectUpdate = z.infer<typeof subjectUpdateSchema>;
type ExamTypeUpdate = z.infer<typeof examTypeUpdateSchema>;
type SubjectImport = z.infer<typeof subjectImportSchema>;
type ApplyCurriculum = z.infer<typeof applyCurriculumSchema>;
type MemberCreate = z.infer<typeof memberCreateSchema>;
type MemberUpdate = z.infer<typeof memberUpdateSchema>;
type MemberActionInput = z.infer<typeof memberActionSchema>;

const DEFAULT_EXAM_TYPES = [
  { code: "CT", name: "CT", sortOrder: 1 },
  { code: "ST", name: "ST", sortOrder: 2 },
  { code: "MID_SEM", name: "Mid-Sem", sortOrder: 3 },
  { code: "END_SEM", name: "End-Sem", sortOrder: 4 },
];

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "item";
  let candidate = root;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
    if (n > 50) throw conflict("Could not generate a unique slug.");
  }
  return candidate;
}

/* ----------------------------- colleges ---------------------------------- */

export async function createCollege(actor: SessionUser, input: CollegeInput) {
  const slug = await uniqueSlug(input.slug || input.name, async (candidate) =>
    Boolean(await prisma.college.findUnique({ where: { slug: candidate } })),
  );
  const college = await prisma.college.create({
    data: {
      slug,
      name: input.name,
      shortName: input.shortName,
      city: input.city,
      state: input.state,
      university: input.university,
      about: input.about || null,
      accent: input.accent,
      verified: Boolean(input.verified),
      featured: Boolean(input.featured),
      examTypes: { create: DEFAULT_EXAM_TYPES },
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "college.created",
    entityType: "College",
    entityId: college.id,
    after: { name: college.name, slug: college.slug },
  });
  return college;
}

export async function updateCollege(actor: SessionUser, input: CollegeUpdate) {
  const before = await prisma.college.findUnique({ where: { id: input.collegeId } });
  if (!before) throw notFound("College");
  const college = await prisma.college.update({
    where: { id: before.id },
    data: {
      name: input.name,
      shortName: input.shortName,
      city: input.city,
      state: input.state,
      university: input.university,
      about: input.about || null,
      accent: input.accent,
      verified: Boolean(input.verified),
      featured: Boolean(input.featured),
      ...(input.slug && input.slug !== before.slug ? { slug: input.slug } : {}),
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "college.updated",
    entityType: "College",
    entityId: college.id,
    before: { name: before.name, verified: before.verified },
    after: { name: college.name, verified: college.verified },
  });
  return college;
}

/* ----------------------------- academics --------------------------------- */

export async function createProgram(actor: SessionUser, input: ProgramInput) {
  const college = await prisma.college.findUnique({ where: { id: input.collegeId } });
  if (!college) throw notFound("College");
  const slug = await uniqueSlug(input.slug || input.name, async (candidate) =>
    Boolean(
      await prisma.program.findFirst({ where: { collegeId: college.id, slug: candidate } }),
    ),
  );
  const program = await prisma.program.create({
    data: {
      collegeId: college.id,
      slug,
      name: input.name,
      level: input.level,
      semesterCount: input.semesterCount,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "program.created",
    entityType: "Program",
    entityId: program.id,
    after: { college: college.shortName, name: program.name },
  });
  return program;
}

/** Creates the branch plus its semesters and a current curriculum version. */
export async function createBranch(actor: SessionUser, input: BranchInput) {
  const program = await prisma.program.findUnique({ where: { id: input.programId } });
  if (!program) throw notFound("Program");
  const slug = await uniqueSlug(input.slug || input.code, async (candidate) =>
    Boolean(await prisma.branch.findFirst({ where: { programId: program.id, slug: candidate } })),
  );
  const branch = await prisma.branch.create({
    data: {
      programId: program.id,
      slug,
      name: input.name,
      code: input.code.toUpperCase(),
      semesters: {
        create: Array.from({ length: program.semesterCount }, (_, i) => ({ number: i + 1 })),
      },
      curricula: {
        create: {
          label: `Curriculum ${new Date().getFullYear()}`,
          effectiveYear: new Date().getFullYear(),
          isCurrent: true,
        },
      },
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "branch.created",
    entityType: "Branch",
    entityId: branch.id,
    after: { program: program.name, code: branch.code },
  });
  return branch;
}

export async function createSemester(actor: SessionUser, input: SemesterInput) {
  const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) throw notFound("Branch");
  const existing = await prisma.semester.findFirst({
    where: { branchId: branch.id, number: input.number },
  });
  if (existing) throw conflict(`Semester ${input.number} already exists for this branch.`);
  const semester = await prisma.semester.create({
    data: { branchId: branch.id, number: input.number },
  });
  await recordAudit({
    actorId: actor.id,
    action: "semester.created",
    entityType: "Semester",
    entityId: semester.id,
    after: { branch: branch.code, number: semester.number },
  });
  return semester;
}

export async function createSubject(actor: SessionUser, input: SubjectInput) {
  const semester = await prisma.semester.findUnique({
    where: { id: input.semesterId },
    include: { branch: { include: { curricula: true } } },
  });
  if (!semester) throw notFound("Semester");
  const slug = await uniqueSlug(input.slug || input.name, async (candidate) =>
    Boolean(
      await prisma.subject.findFirst({ where: { semesterId: semester.id, slug: candidate } }),
    ),
  );
  const curriculumVersionId =
    input.curriculumVersionId ||
    semester.branch.curricula.find((version) => version.isCurrent)?.id ||
    null;

  const subject = await prisma.subject.create({
    data: {
      semesterId: semester.id,
      slug,
      name: input.name,
      code: input.code.toUpperCase(),
      curriculumVersionId,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "subject.created",
    entityType: "Subject",
    entityId: subject.id,
    after: { name: subject.name, code: subject.code, semester: semester.number },
  });
  return subject;
}

export async function createExamType(actor: SessionUser, input: ExamTypeInput) {
  const college = await prisma.college.findUnique({ where: { id: input.collegeId } });
  if (!college) throw notFound("College");
  const existing = await prisma.examType.findFirst({
    where: { collegeId: college.id, code: input.code },
  });
  if (existing) throw conflict(`${input.code} already exists for ${college.shortName}.`);
  const examType = await prisma.examType.create({
    data: {
      collegeId: college.id,
      code: input.code,
      name: input.name,
      sortOrder: input.sortOrder,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "examType.created",
    entityType: "ExamType",
    entityId: examType.id,
    after: { college: college.shortName, code: examType.code },
  });
  return examType;
}

/* ------------------------------- deletes --------------------------------- */

/** Counts published/queued papers that would be destroyed with an entity. */
async function paperCountUnder(where: Record<string, unknown>) {
  return prisma.paper.count({ where: where as never });
}

async function assertSafeDelete(label: string, count: number, force?: boolean) {
  if (count > 0 && !force) {
    throw conflict(
      `${label} still holds ${count} paper${count === 1 ? "" : "s"}. Tick "Delete anyway" to remove it and its papers, or archive it instead.`,
    );
  }
}

export async function deleteEntity(
  actor: SessionUser,
  input: { entity: string; id: string; force?: boolean },
) {
  switch (input.entity) {
    case "college": {
      const college = await prisma.college.findUnique({ where: { id: input.id } });
      if (!college) throw notFound("College");
      const count = await paperCountUnder({
        paperSet: {
          examSession: {
            subject: { semester: { branch: { program: { collegeId: college.id } } } },
          },
        },
      });
      await assertSafeDelete(college.shortName, count, input.force);
      await prisma.$transaction([
        prisma.user.updateMany({ where: { collegeId: college.id }, data: { collegeId: null } }),
        prisma.college.delete({ where: { id: college.id } }),
      ]);
      await recordAudit({
        actorId: actor.id,
        action: "college.deleted",
        entityType: "College",
        entityId: college.id,
        before: { name: college.name, papers: count },
      });
      return { message: `${college.shortName} deleted.` };
    }
    case "program": {
      const program = await prisma.program.findUnique({ where: { id: input.id } });
      if (!program) throw notFound("Program");
      const count = await paperCountUnder({
        paperSet: {
          examSession: { subject: { semester: { branch: { programId: program.id } } } },
        },
      });
      await assertSafeDelete(program.name, count, input.force);
      await prisma.program.delete({ where: { id: program.id } });
      await recordAudit({
        actorId: actor.id,
        action: "program.deleted",
        entityType: "Program",
        entityId: program.id,
        before: { name: program.name, papers: count },
      });
      return { message: `${program.name} deleted.` };
    }
    case "branch": {
      const branch = await prisma.branch.findUnique({ where: { id: input.id } });
      if (!branch) throw notFound("Branch");
      const count = await paperCountUnder({
        paperSet: { examSession: { subject: { semester: { branchId: branch.id } } } },
      });
      await assertSafeDelete(branch.code, count, input.force);
      await prisma.branch.delete({ where: { id: branch.id } });
      await recordAudit({
        actorId: actor.id,
        action: "branch.deleted",
        entityType: "Branch",
        entityId: branch.id,
        before: { code: branch.code, papers: count },
      });
      return { message: `${branch.code} deleted.` };
    }
    case "semester": {
      const semester = await prisma.semester.findUnique({ where: { id: input.id } });
      if (!semester) throw notFound("Semester");
      const count = await paperCountUnder({
        paperSet: { examSession: { subject: { semesterId: semester.id } } },
      });
      await assertSafeDelete(`Semester ${semester.number}`, count, input.force);
      await prisma.semester.delete({ where: { id: semester.id } });
      await recordAudit({
        actorId: actor.id,
        action: "semester.deleted",
        entityType: "Semester",
        entityId: semester.id,
        before: { number: semester.number, papers: count },
      });
      return { message: `Semester ${semester.number} deleted.` };
    }
    case "subject": {
      const subject = await prisma.subject.findUnique({ where: { id: input.id } });
      if (!subject) throw notFound("Subject");
      const count = await paperCountUnder({ paperSet: { examSession: { subjectId: subject.id } } });
      await assertSafeDelete(subject.name, count, input.force);
      await prisma.subject.delete({ where: { id: subject.id } });
      await recordAudit({
        actorId: actor.id,
        action: "subject.deleted",
        entityType: "Subject",
        entityId: subject.id,
        before: { name: subject.name, papers: count },
      });
      return { message: `${subject.name} deleted.` };
    }
    case "examType": {
      const examType = await prisma.examType.findUnique({ where: { id: input.id } });
      if (!examType) throw notFound("Exam type");
      const count = await paperCountUnder({ paperSet: { examSession: { examTypeId: examType.id } } });
      await assertSafeDelete(examType.name, count, input.force);
      await prisma.examType.delete({ where: { id: examType.id } });
      await recordAudit({
        actorId: actor.id,
        action: "examType.deleted",
        entityType: "ExamType",
        entityId: examType.id,
        before: { code: examType.code, papers: count },
      });
      return { message: `${examType.name} deleted.` };
    }
    case "examSession": {
      const session = await prisma.examSession.findUnique({
        where: { id: input.id },
        include: { subject: true, examType: true },
      });
      if (!session) throw notFound("Exam session");
      const count = await paperCountUnder({ paperSet: { examSessionId: session.id } });
      await assertSafeDelete(
        `${session.subject.code} ${session.examType.code} ${session.academicYear}`,
        count,
        input.force,
      );
      await prisma.examSession.delete({ where: { id: session.id } });
      await recordAudit({
        actorId: actor.id,
        action: "examSession.deleted",
        entityType: "ExamSession",
        entityId: session.id,
        before: { subject: session.subject.name, year: session.academicYear, papers: count },
      });
      return { message: `${session.examType.code} ${session.academicYear} deleted.` };
    }
    case "paperSet": {
      const set = await prisma.paperSet.findUnique({ where: { id: input.id } });
      if (!set) throw notFound("Paper set");
      const count = await paperCountUnder({ paperSetId: set.id });
      await assertSafeDelete(set.label, count, input.force);
      await prisma.paperSet.delete({ where: { id: set.id } });
      await recordAudit({
        actorId: actor.id,
        action: "paperSet.deleted",
        entityType: "PaperSet",
        entityId: set.id,
        before: { label: set.label, papers: count },
      });
      return { message: `${set.label} deleted.` };
    }
    case "curriculumVersion": {
      const version = await prisma.curriculumVersion.findUnique({
        where: { id: input.id },
        include: { _count: { select: { subjects: true } } },
      });
      if (!version) throw notFound("Curriculum version");
      // Subjects survive: the version link is metadata, not ownership.
      await prisma.subject.updateMany({
        where: { curriculumVersionId: version.id },
        data: { curriculumVersionId: null },
      });
      await prisma.curriculumVersion.delete({ where: { id: version.id } });
      await recordAudit({
        actorId: actor.id,
        action: "curriculumVersion.deleted",
        entityType: "CurriculumVersion",
        entityId: version.id,
        before: { label: version.label, subjects: version._count.subjects },
      });
      return { message: `${version.label} deleted. Its subjects were kept.` };
    }
    case "paper": {
      const paper = await prisma.paper.findUnique({ where: { id: input.id }, include: { files: true } });
      if (!paper) throw notFound("Paper");
      for (const file of paper.files) {
        await storage().delete(file.storageKey);
      }
      await prisma.paper.delete({ where: { id: paper.id } });
      await recordAudit({
        actorId: actor.id,
        action: "paper.deleted",
        entityType: "Paper",
        entityId: paper.id,
        before: { title: paper.title, status: paper.status, files: paper.files.length },
      });
      return { message: "Paper and its files deleted." };
    }
    case "user": {
      if (input.id === actor.id) throw validation("You cannot delete your own account here.");
      const user = await prisma.user.findUnique({ where: { id: input.id } });
      if (!user) throw notFound("User");
      await assertNotLastAdmin(user.id, "This is the last platform admin and cannot be deleted.");
      const uploads = await prisma.paper.count({ where: { uploadedById: user.id } });
      await assertSafeDelete(user.name, uploads, input.force);
      await prisma.$transaction([
        prisma.paper.deleteMany({ where: { uploadedById: user.id } }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);
      await recordAudit({
        actorId: actor.id,
        action: "user.deleted",
        entityType: "User",
        entityId: user.id,
        before: { email: user.email, uploads },
      });
      return { message: `${user.name} deleted.` };
    }
    case "report": {
      const report = await prisma.report.findUnique({ where: { id: input.id } });
      if (!report) throw notFound("Report");
      await prisma.report.delete({ where: { id: report.id } });
      await recordAudit({
        actorId: actor.id,
        action: "report.deleted",
        entityType: "Report",
        entityId: report.id,
      });
      return { message: "Report deleted." };
    }
    default:
      throw validation("Unknown entity type.");
  }
}

/* ------------------------------ overview --------------------------------- */

export function adminCollegeList() {
  return prisma.college.findMany({
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    include: {
      programs: { include: { branches: { select: { id: true } } } },
      examTypes: { select: { id: true } },
      _count: { select: { users: true } },
    },
  });
}

/**
 * College workspace data. Subject *rows* deliberately are not loaded here:
 * a college carries hundreds of subjects and the page only needs counts. The
 * rows live on the branch workspace, one branch at a time.
 */
export async function adminCollegeDetail(collegeId: string) {
  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    include: {
      examTypes: { orderBy: { sortOrder: "asc" } },
      programs: {
        // "UG" sorts after "PG", so descending puts undergraduate degrees
        // first, which is what an admin expects to see at the top.
        orderBy: [{ level: "desc" }, { name: "asc" }],
        include: {
          branches: {
            orderBy: { code: "asc" },
            include: { _count: { select: { semesters: true } } },
          },
        },
      },
    },
  });
  if (!college) return null;

  // One grouped query for every branch's subject count beats N per-branch ones.
  const branchIds = college.programs.flatMap((program) => program.branches.map((b) => b.id));
  const semesters = branchIds.length
    ? await prisma.semester.findMany({
        where: { branchId: { in: branchIds } },
        select: { branchId: true, _count: { select: { subjects: true } } },
      })
    : [];
  const subjectCounts = new Map<string, number>();
  for (const semester of semesters) {
    subjectCounts.set(
      semester.branchId,
      (subjectCounts.get(semester.branchId) ?? 0) + semester._count.subjects,
    );
  }

  return {
    ...college,
    programs: college.programs.map((program) => ({
      ...program,
      branches: program.branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        archived: branch.archived,
        semesterCount: branch._count.semesters,
        subjectCount: subjectCounts.get(branch.id) ?? 0,
      })),
    })),
  };
}

/* ------------------------------- papers ---------------------------------- */

const ADMIN_PAPER_TARGET: Record<string, string> = {
  REMOVE: "REMOVED",
  RESTORE: "PUBLISHED",
  RESTRICT: "RESTRICTED",
  PUBLISH: "PUBLISHED",
};

/**
 * Platform admins can override the normal lifecycle graph (for example to
 * restore a REMOVED paper), so this bypasses PAPER_TRANSITIONS on purpose and
 * always writes an audit entry plus a paper event.
 */
export async function setPaperStatusAdmin(
  actor: SessionUser,
  input: { paperId: string; action: string; note?: string },
) {
  const target = ADMIN_PAPER_TARGET[input.action];
  if (!target) throw validation("Unknown paper action.");
  const paper = await prisma.paper.findUnique({ where: { id: input.paperId } });
  if (!paper) throw notFound("Paper");
  if (paper.status === target) throw conflict(`Paper is already ${target.toLowerCase()}.`);
  if (target === "PUBLISHED") await settleClassificationForRelease(paper.id, actor.id);

  const updated = await prisma.paper.update({
    where: { id: paper.id },
    data: {
      status: target,
      publishedAt: target === "PUBLISHED" ? (paper.publishedAt ?? new Date()) : paper.publishedAt,
    },
  });
  await prisma.paperEvent.create({
    data: {
      paperId: paper.id,
      fromState: paper.status,
      toState: target,
      actorId: actor.id,
      note: input.note || `Admin override by ${actor.name}`,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "paper.admin_status",
    entityType: "Paper",
    entityId: paper.id,
    before: { status: paper.status },
    after: { status: updated.status },
  });
  await sendDecisionEmail(paper.id, target, input.note || null);
  return updated;
}

/** Shared shape for the paged admin tables. */
export type Page<T> = {
  rows: T[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
};

/** Clamps a user-supplied page number so a hand-edited URL cannot break a query. */
function pageWindow(page: number | undefined, perPage: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.floor(page ?? 1) || 1), pages);
  return { pages, current, skip: (current - 1) * perPage };
}

function adminPaperWhere(filter: { status?: string; q?: string }) {
  const q = filter.q?.trim();
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { paperSet: { examSession: { subject: { name: { contains: q, mode: "insensitive" as const } } } } },
            { paperSet: { examSession: { subject: { code: { contains: q, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };
}

export async function adminPaperList(filter: {
  status?: string;
  q?: string;
  page?: number;
  perPage?: number;
}) {
  const perPage = filter.perPage ?? 40;
  const where = adminPaperWhere(filter);
  const total = await prisma.paper.count({ where });
  const { pages, current, skip } = pageWindow(filter.page, perPage, total);

  const rows = await prisma.paper.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: perPage,
    include: {
      uploadedBy: { select: { id: true, name: true } },
      _count: { select: { files: true, reports: true } },
      paperSet: {
        include: {
          examSession: {
            include: {
              examType: true,
              subject: {
                include: {
                  semester: { include: { branch: { include: { program: { include: { college: true } } } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  return { rows, total, page: current, pages, perPage };
}

export async function adminUserList(filter: { q?: string; page?: number; perPage?: number } = {}) {
  const perPage = filter.perPage ?? 40;
  const q = filter.q?.trim();
  const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {};
  const total = await prisma.user.count({ where });
  const { pages, current, skip } = pageWindow(filter.page, perPage, total);

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    skip,
    take: perPage,
    include: {
      college: { select: { id: true, shortName: true } },
      _count: { select: { papers: true } },
    },
  });
  return { rows, total, page: current, pages, perPage };
}

/* ------------------------- taxonomy edits -------------------------------- */

export async function updateProgram(actor: SessionUser, input: ProgramUpdate) {
  const existing = await prisma.program.findUnique({ where: { id: input.programId } });
  if (!existing) throw notFound("Program");
  const slug =
    input.slug && input.slug !== existing.slug
      ? await uniqueSlug(input.slug, async (candidate) =>
          Boolean(
            await prisma.program.findFirst({
              where: { collegeId: existing.collegeId, slug: candidate, NOT: { id: existing.id } },
            }),
          ),
        )
      : existing.slug;

  const program = await prisma.program.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      slug,
      level: input.level,
      semesterCount: input.semesterCount,
      archived: Boolean(input.archived),
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "program.updated",
    entityType: "Program",
    entityId: program.id,
    before: { name: existing.name, semesterCount: existing.semesterCount },
    after: { name: program.name, semesterCount: program.semesterCount },
  });
  return program;
}

export async function updateBranch(actor: SessionUser, input: BranchUpdate) {
  const existing = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!existing) throw notFound("Branch");
  const slug =
    input.slug && input.slug !== existing.slug
      ? await uniqueSlug(input.slug, async (candidate) =>
          Boolean(
            await prisma.branch.findFirst({
              where: { programId: existing.programId, slug: candidate, NOT: { id: existing.id } },
            }),
          ),
        )
      : existing.slug;

  const branch = await prisma.branch.update({
    where: { id: existing.id },
    data: { name: input.name, code: input.code, slug, archived: Boolean(input.archived) },
  });
  await recordAudit({
    actorId: actor.id,
    action: "branch.updated",
    entityType: "Branch",
    entityId: branch.id,
    before: { name: existing.name, code: existing.code },
    after: { name: branch.name, code: branch.code },
  });
  return branch;
}

export async function updateSubject(actor: SessionUser, input: SubjectUpdate) {
  const existing = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!existing) throw notFound("Subject");
  const desired = input.slug || `${slugify(input.name)}-${input.code.toLowerCase()}`;
  const slug =
    desired !== existing.slug
      ? await uniqueSlug(desired, async (candidate) =>
          Boolean(
            await prisma.subject.findFirst({
              where: { semesterId: existing.semesterId, slug: candidate, NOT: { id: existing.id } },
            }),
          ),
        )
      : existing.slug;

  const subject = await prisma.subject.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      code: input.code,
      slug,
      archived: Boolean(input.archived),
      curriculumVersionId: input.curriculumVersionId || null,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "subject.updated",
    entityType: "Subject",
    entityId: subject.id,
    before: { name: existing.name, code: existing.code },
    after: { name: subject.name, code: subject.code },
  });
  return subject;
}

export async function updateExamType(actor: SessionUser, input: ExamTypeUpdate) {
  const existing = await prisma.examType.findUnique({ where: { id: input.examTypeId } });
  if (!existing) throw notFound("Exam type");
  const clash = await prisma.examType.findFirst({
    where: { collegeId: existing.collegeId, code: input.code, NOT: { id: existing.id } },
  });
  if (clash) throw conflict(`This college already has an exam type coded ${input.code}.`);

  const examType = await prisma.examType.update({
    where: { id: existing.id },
    data: { code: input.code, name: input.name, sortOrder: input.sortOrder },
  });
  await recordAudit({
    actorId: actor.id,
    action: "examType.updated",
    entityType: "ExamType",
    entityId: examType.id,
    before: { code: existing.code, name: existing.name },
    after: { code: examType.code, name: examType.name },
  });
  return examType;
}

/* ------------------------- bulk subject import --------------------------- */

const SEPARATOR = /\s*[|\t,;]\s*/;

/** One parsed line of a paste-to-import block. */
export type ParsedSubjectRow = { semester: number; code: string; name: string };

/**
 * Parses a pasted syllabus block. Tolerant on purpose: people paste from
 * spreadsheets, PDFs and websites, and the column order is never the same.
 * Returns the rows it understood plus the lines it could not, so the admin
 * can see exactly what will be created before anything is written.
 */
export function parseSubjectRows(
  raw: string,
  defaultSemester?: number,
): { rows: ParsedSubjectRow[]; rejected: string[] } {
  const rows: ParsedSubjectRow[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^(s\.?\s?no|sr|sl|#)/i.test(trimmed)) continue;

    let parts = trimmed.split(SEPARATOR).filter(Boolean);
    // No separator at all: assume "CODE Subject Name".
    if (parts.length === 1) {
      const match = /^([A-Z]{2,5}[-\s]?\d{2,4}[A-Z]?)\s+(.{3,})$/i.exec(trimmed);
      parts = match ? [match[1], match[2]] : [];
    }
    if (parts.length < 2) {
      rejected.push(trimmed);
      continue;
    }

    // A bare number in any position is the semester.
    let semester = defaultSemester;
    const numberIndex = parts.findIndex((part) => /^(sem(ester)?\s*)?\d{1,2}$/i.test(part));
    if (numberIndex >= 0) {
      semester = Number(parts[numberIndex].replace(/\D/g, ""));
      parts = parts.filter((_, i) => i !== numberIndex);
    }
    if (!semester || semester < 1 || semester > 12) {
      rejected.push(trimmed);
      continue;
    }

    // Whichever remaining field looks like a course code is the code.
    const codeIndex = parts.findIndex((part) => /^[A-Z]{2,5}[-\s]?\d{2,4}[A-Z]?$/i.test(part));
    const code = (codeIndex >= 0 ? parts[codeIndex] : parts[0]).toUpperCase().replace(/\s+/g, "");
    const name = (codeIndex >= 0 ? parts.filter((_, i) => i !== codeIndex) : parts.slice(1))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 2 || code.length < 2) {
      rejected.push(trimmed);
      continue;
    }
    const key = `${semester}:${code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ semester, code, name });
  }

  return { rows, rejected };
}

/**
 * Creates every parsed subject under a branch, creating missing semesters on
 * the way. Existing codes are updated rather than duplicated, so re-importing
 * a corrected list is safe.
 */
export async function importSubjects(actor: SessionUser, input: SubjectImport) {
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    include: { program: true, curricula: { where: { isCurrent: true }, take: 1 } },
  });
  if (!branch) throw notFound("Branch");

  const { rows, rejected } = parseSubjectRows(input.rows, input.defaultSemester);
  if (rows.length === 0) {
    throw validation(
      "None of those lines could be read. Use one subject per line, for example: 5, KCS501, Database Management Systems.",
    );
  }

  if (input.replace) {
    await prisma.subject.deleteMany({
      where: { semester: { branchId: branch.id, number: { in: [...new Set(rows.map((r) => r.semester))] } } },
    });
  }

  const created = await writeSubjectRows(branch, rows);
  await recordAudit({
    actorId: actor.id,
    action: "subject.imported",
    entityType: "Branch",
    entityId: branch.id,
    after: { created: created.created, updated: created.updated, rejected: rejected.length },
  });
  return { ...created, rejected };
}

/** Shared writer for both paste-import and curriculum templates. */
async function writeSubjectRows(
  branch: { id: string; curricula: { id: string }[] },
  rows: ParsedSubjectRow[],
  overwriteNames = true,
) {
  const curriculumVersionId = branch.curricula[0]?.id ?? null;
  const wanted = [...new Set(rows.map((row) => row.semester))].sort((a, b) => a - b);

  // `skipDuplicates` is not supported on SQLite, so the missing numbers are
  // worked out first. This also keeps the audit count honest.
  const already = await prisma.semester.findMany({
    where: { branchId: branch.id, number: { in: wanted } },
    select: { number: true },
  });
  const missing = wanted.filter((number) => !already.some((s) => s.number === number));
  if (missing.length) {
    await prisma.semester.createMany({
      data: missing.map((number) => ({ branchId: branch.id, number })),
    });
  }
  const semesters = await prisma.semester.findMany({
    where: { branchId: branch.id, number: { in: wanted } },
    select: { id: true, number: true, subjects: { select: { id: true, code: true, name: true } } },
  });
  const byNumber = new Map(semesters.map((semester) => [semester.number, semester]));

  let createdCount = 0;
  let updatedCount = 0;
  for (const row of rows) {
    const semester = byNumber.get(row.semester);
    if (!semester) continue;
    const existing = semester.subjects.find(
      (subject) => subject.code.toUpperCase() === row.code.toUpperCase(),
    );
    if (existing) {
      if (overwriteNames && existing.name !== row.name) {
        await prisma.subject.update({ where: { id: existing.id }, data: { name: row.name } });
        updatedCount += 1;
      }
      continue;
    }
    const slug = await uniqueSlug(`${row.name}-${row.code}`, async (candidate) =>
      Boolean(
        await prisma.subject.findFirst({ where: { semesterId: semester.id, slug: candidate } }),
      ),
    );
    await prisma.subject.create({
      data: {
        semesterId: semester.id,
        curriculumVersionId,
        slug,
        name: row.name,
        code: row.code,
      },
    });
    createdCount += 1;
  }
  return { created: createdCount, updated: updatedCount };
}

/**
 * Fills a branch from the shared catalogue in `src/data/curriculum.ts`.
 * Nothing is deleted and existing codes are kept, so this is safe to run on a
 * branch an admin has already hand-edited.
 */
export async function applyCurriculumTemplate(actor: SessionUser, input: ApplyCurriculum) {
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    include: { program: true, curricula: { where: { isCurrent: true }, take: 1 } },
  });
  if (!branch) throw notFound("Branch");

  const catalogue = curriculumFor(branch.program.slug, branch.code);
  if (!catalogue) {
    throw validation(
      `No catalogue entry for ${branch.program.name} ${branch.code}. Use the paste importer instead.`,
    );
  }
  const rows = curriculumRows(catalogue).filter((row) => row.semester <= branch.program.semesterCount);
  const result = await writeSubjectRows(branch, rows, Boolean(input.overwriteNames));

  await recordAudit({
    actorId: actor.id,
    action: "curriculum.applied",
    entityType: "Branch",
    entityId: branch.id,
    after: { template: `${branch.program.slug}:${branch.code}`, ...result },
  });
  return result;
}

/* ---------------------------- branch workspace --------------------------- */

export async function adminBranchDetail(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      curricula: { orderBy: { effectiveYear: "desc" } },
      program: { include: { college: true } },
      semesters: {
        orderBy: { number: "asc" },
        include: {
          subjects: { orderBy: [{ code: "asc" }] },
          _count: { select: { subjects: true } },
        },
      },
    },
  });
  if (!branch) return null;
  const catalogue = curriculumFor(branch.program.slug, branch.code);
  return {
    ...branch,
    template: catalogue
      ? { key: curriculumKey(branch.program.slug, branch.code), subjects: curriculumSubjectCount(catalogue) }
      : null,
  };
}

/* ---------------------------- control center ----------------------------- */

export async function controlCenterCounts() {
  const [
    colleges,
    programs,
    branches,
    semesters,
    subjects,
    examTypes,
    examSessions,
    paperSets,
    papers,
    members,
  ] = await Promise.all([
    prisma.college.count(),
    prisma.program.count(),
    prisma.branch.count(),
    prisma.semester.count(),
    prisma.subject.count(),
    prisma.examType.count(),
    prisma.examSession.count(),
    prisma.paperSet.count(),
    prisma.paper.count(),
    prisma.user.count(),
  ]);
  return { colleges, programs, branches, semesters, subjects, examTypes, examSessions, paperSets, papers, members };
}

/**
 * One search box over the whole platform. Each group is capped so a query like
 * "a" cannot pull thousands of rows into a page render.
 */
export async function controlCenterSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return null;
  const take = 8;

  const [colleges, programs, branches, subjects, members, papers] = await Promise.all([
    prisma.college.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { shortName: { contains: q, mode: "insensitive" as const } }, { city: { contains: q, mode: "insensitive" as const } }] },
      take,
      select: { id: true, name: true, shortName: true, city: true },
    }),
    prisma.program.findMany({
      where: { name: { contains: q, mode: "insensitive" as const } },
      take,
      include: { college: { select: { id: true, shortName: true } } },
    }),
    prisma.branch.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { code: { contains: q, mode: "insensitive" as const } }] },
      take,
      include: { program: { include: { college: { select: { id: true, shortName: true } } } } },
    }),
    prisma.subject.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { code: { contains: q, mode: "insensitive" as const } }] },
      take,
      include: {
        semester: {
          include: {
            branch: { include: { program: { include: { college: { select: { shortName: true } } } } } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] },
      take,
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.paper.findMany({
      where: { title: { contains: q, mode: "insensitive" as const } },
      take,
      select: { id: true, title: true, status: true },
    }),
  ]);

  return { query: q, colleges, programs, branches, subjects, members, papers };
}

/* --------------------------- member management --------------------------- */

export async function adminMemberDetail(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      trustLevel: true,
      collegeId: true,
      college: { select: { id: true, shortName: true } },
      emailVerifiedAt: true,
      totpConfirmedAt: true,
      bannedAt: true,
      banReason: true,
      status: true,
      statusReason: true,
      statusUntil: true,
      teacherVerifiedAt: true,
      createdAt: true,
      _count: { select: { papers: true, comments: true, sessions: true } },
    },
  });
}

/** Platform admins are the only account type that can lock everyone out. */
async function assertNotLastAdmin(userId: string, message: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role !== "PLATFORM_ADMIN") return;
  const remaining = await prisma.user.count({
    where: { role: "PLATFORM_ADMIN", bannedAt: null, anonymizedAt: null, NOT: { id: userId } },
  });
  if (remaining === 0) throw conflict(message);
}

export async function createMember(actor: SessionUser, input: MemberCreate) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with that email already exists.");
  if (input.role !== "STUDENT" && input.role !== "PLATFORM_ADMIN" && !input.collegeId) {
    throw validation("Moderators and college admins must be scoped to a college.");
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      trustLevel: input.trustLevel,
      collegeId: input.collegeId || null,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "user.created",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, role: user.role },
  });
  return user;
}

export async function updateMember(actor: SessionUser, input: MemberUpdate) {
  const existing = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!existing) throw notFound("Member");
  if (existing.anonymizedAt) throw conflict("This account has been erased and cannot be edited.");
  if (input.role === "TEACHER" && existing.role !== "TEACHER") {
    throw forbidden("The teacher role is granted only by approving a teacher verification request.");
  }
  if (existing.role === "TEACHER" && input.role !== "TEACHER") {
    throw conflict("Revoke this member's teacher verification first; that removes the teacher role.");
  }
  if (input.role !== "STUDENT" && input.role !== "TEACHER" && input.role !== "PLATFORM_ADMIN" && !input.collegeId) {
    throw validation("Moderators and college admins must be scoped to a college.");
  }
  if (existing.role === "PLATFORM_ADMIN" && input.role !== "PLATFORM_ADMIN") {
    await assertNotLastAdmin(existing.id, "This is the last platform admin. Promote someone else first.");
  }
  if (input.email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email: input.email } });
    if (clash) throw conflict("Another account already uses that email.");
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      trustLevel: input.trustLevel,
      collegeId: input.collegeId || null,
      // Changing the address invalidates the old proof of ownership.
      emailVerifiedAt: input.email === existing.email ? existing.emailVerifiedAt : null,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "user.updated",
    entityType: "User",
    entityId: user.id,
    before: { email: existing.email, role: existing.role, collegeId: existing.collegeId },
    after: { email: user.email, role: user.role, collegeId: user.collegeId },
  });
  return user;
}

/**
 * Quick role change from the users table. Same guards as updateMember: an
 * erased account stays frozen, staff roles need a college, and the last
 * platform admin cannot be demoted.
 */
export async function changeRole(
  actor: SessionUser,
  input: { userId: string; role: string; collegeId?: string | null },
) {
  const existing = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!existing) throw notFound("Member");
  if (existing.anonymizedAt) throw conflict("This account has been erased and cannot be edited.");
  if (input.role === "TEACHER" && existing.role !== "TEACHER") {
    throw forbidden("The teacher role is granted only by approving a teacher verification request.");
  }
  if (existing.role === "TEACHER" && input.role !== "TEACHER") {
    throw conflict("Revoke this member's teacher verification first; that removes the teacher role.");
  }
  if (input.role !== "STUDENT" && input.role !== "TEACHER" && input.role !== "PLATFORM_ADMIN" && !input.collegeId) {
    throw validation("Moderators and college admins must be scoped to a college.");
  }
  if (input.collegeId) {
    const college = await prisma.college.findUnique({ where: { id: input.collegeId }, select: { id: true } });
    if (!college) throw notFound("College");
  }
  if (existing.role === "PLATFORM_ADMIN" && input.role !== "PLATFORM_ADMIN") {
    await assertNotLastAdmin(existing.id, "This is the last platform admin. Promote someone else first.");
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { role: input.role, collegeId: input.collegeId || null },
  });
  await recordAudit({
    actorId: actor.id,
    action: "user.role_changed",
    entityType: "User",
    entityId: user.id,
    before: { role: existing.role, collegeId: existing.collegeId },
    after: { role: user.role, collegeId: user.collegeId },
  });
  return user;
}

/**
 * Ban, unban, force email verification, clear 2FA and revoke sessions.
 * Every branch bumps `credentialsSetAt` where it should, which is what makes
 * already-issued session cookies stop working.
 */
export async function memberAction(actor: SessionUser, input: MemberActionInput) {
  const target = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!target) throw notFound("Member");
  if (target.anonymizedAt) throw conflict("This account has been erased.");

  // Standing changes have their own audited path (with notification).
  const standing: Partial<Record<MemberActionInput["action"], UserStatus>> = {
    WARN: "WARNED",
    RESTRICT: "RESTRICTED",
    SUSPEND: "SUSPENDED",
    BAN: "BANNED",
    UNBAN: "ACTIVE",
  };
  const nextStatus = standing[input.action];
  if (nextStatus) {
    if (input.action === "BAN" && target.id === actor.id) throw conflict("You cannot ban your own account.");
    await setUserStanding(actor, {
      userId: target.id,
      status: nextStatus,
      reason: input.reason || null,
      days: input.action === "SUSPEND" ? input.days ?? null : null,
    });
    return { message: MEMBER_ACTION_MESSAGE[input.action](target.name) };
  }

  switch (input.action) {
    case "VERIFY_EMAIL":
      await prisma.user.update({
        where: { id: target.id },
        data: { emailVerifiedAt: target.emailVerifiedAt ?? new Date() },
      });
      break;
    case "RESET_2FA":
      await prisma.user.update({
        where: { id: target.id },
        data: { totpSecret: null, totpConfirmedAt: null, totpRecovery: null },
      });
      break;
    case "REVOKE_SESSIONS":
      await prisma.user.update({ where: { id: target.id }, data: { credentialsSetAt: new Date() } });
      await prisma.session.deleteMany({ where: { userId: target.id } });
      break;
  }

  await recordAudit({
    actorId: actor.id,
    action: `user.${input.action.toLowerCase()}`,
    entityType: "User",
    entityId: target.id,
    after: { email: target.email, reason: input.reason || undefined },
  });
  return { message: MEMBER_ACTION_MESSAGE[input.action](target.name) };
}

const MEMBER_ACTION_MESSAGE: Record<MemberActionInput["action"], (name: string) => string> = {
  WARN: (name) => `${name} has been warned.`,
  RESTRICT: (name) => `${name} is restricted: browsing only, no uploads, comments or reports.`,
  SUSPEND: (name) => `${name} is suspended and signed out everywhere.`,
  BAN: (name) => `${name} is banned and signed out everywhere.`,
  UNBAN: (name) => `${name} is back in good standing.`,
  VERIFY_EMAIL: (name) => `${name}'s email is marked as confirmed.`,
  RESET_2FA: (name) => `Two-step verification cleared for ${name}.`,
  REVOKE_SESSIONS: (name) => `${name} is signed out on every device.`,
};

/**
 * Exam sessions and paper sets under a branch that hold no papers.
 *
 * Both are created implicitly the first time somebody uploads, and they are
 * left behind when a paper is later removed. They are invisible to students
 * but they clutter the taxonomy, so the branch workspace lists them for
 * one-click cleanup. Capped because a large branch could have many.
 */
export async function emptyExamSlots(branchId: string) {
  const [sessions, sets] = await Promise.all([
    prisma.examSession.findMany({
      where: { subject: { semester: { branchId } }, sets: { none: {} } },
      take: 50,
      orderBy: [{ academicYear: "desc" }],
      include: { subject: { select: { code: true, name: true } }, examType: { select: { code: true } } },
    }),
    prisma.paperSet.findMany({
      where: { examSession: { subject: { semester: { branchId } } }, papers: { none: {} } },
      take: 50,
      include: {
        examSession: {
          include: {
            subject: { select: { code: true, name: true } },
            examType: { select: { code: true } },
          },
        },
      },
    }),
  ]);
  return { sessions, sets };
}
