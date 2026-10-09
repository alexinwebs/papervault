import { prisma } from "@/lib/db";

export function programBySlug(collegeSlug: string, programSlug: string) {
  return prisma.program.findFirst({
    where: { slug: programSlug, archived: false, college: { slug: collegeSlug } },
    include: {
      college: true,
      branches: { where: { archived: false }, orderBy: { name: "asc" } },
    },
  });
}

export function branchBySlug(collegeSlug: string, programSlug: string, branchSlug: string) {
  return prisma.branch.findFirst({
    where: {
      slug: branchSlug,
      archived: false,
      program: { slug: programSlug, archived: false, college: { slug: collegeSlug } },
    },
    include: {
      program: { include: { college: true } },
      semesters: { orderBy: { number: "asc" } },
      curricula: { orderBy: { effectiveYear: "desc" } },
    },
  });
}

export function semesterByNumber(
  collegeSlug: string,
  programSlug: string,
  branchSlug: string,
  number: number,
) {
  return prisma.semester.findFirst({
    where: {
      number,
      branch: {
        slug: branchSlug,
        archived: false,
        program: { slug: programSlug, archived: false, college: { slug: collegeSlug } },
      },
    },
    include: {
      branch: { include: { program: { include: { college: true } } } },
      subjects: { where: { archived: false }, orderBy: { name: "asc" } },
    },
  });
}

export function subjectBySlug(
  collegeSlug: string,
  programSlug: string,
  branchSlug: string,
  semesterNumber: number,
  subjectSlug: string,
) {
  return prisma.subject.findFirst({
    where: {
      slug: subjectSlug,
      archived: false,
      semester: {
        number: semesterNumber,
        branch: {
          slug: branchSlug,
          archived: false,
          program: { slug: programSlug, archived: false, college: { slug: collegeSlug } },
        },
      },
    },
    include: {
      curriculumVersion: true,
      semester: {
        include: { branch: { include: { program: { include: { college: true } } } } },
      },
    },
  });
}

/** Cascade used by the upload form and by server-side metadata validation. */
export function academicTree(collegeId: string) {
  return prisma.program.findMany({
    where: { collegeId, archived: false },
    orderBy: { name: "asc" },
    include: {
      branches: {
        where: { archived: false },
        orderBy: { name: "asc" },
        include: {
          semesters: {
            orderBy: { number: "asc" },
            include: {
              subjects: {
                where: { archived: false },
                orderBy: { name: "asc" },
                select: { id: true, name: true, code: true, slug: true },
              },
            },
          },
        },
      },
    },
  });
}

/** Verifies the full college -> subject chain belongs together. Never trust the client. */
export async function assertAcademicChain(input: {
  collegeId: string;
  programId: string;
  branchId: string;
  semesterId: string;
  subjectId: string;
  examTypeId: string;
}) {
  const subject = await prisma.subject.findFirst({
    where: {
      id: input.subjectId,
      semesterId: input.semesterId,
      archived: false,
      semester: {
        branchId: input.branchId,
        branch: { programId: input.programId, program: { collegeId: input.collegeId } },
      },
    },
    include: {
      semester: { include: { branch: { include: { program: { include: { college: true } } } } } },
    },
  });
  if (!subject) return null;
  const examType = await prisma.examType.findFirst({
    where: { id: input.examTypeId, collegeId: input.collegeId },
  });
  if (!examType) return null;
  return { subject, examType, college: subject.semester.branch.program.college };
}
