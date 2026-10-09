import { prisma } from "@/lib/db";
import { PUBLIC_PAPER_WHERE } from "../repositories/papers";

export async function platformStats() {
  const [colleges, papers, students, contributorRows] = await prisma.$transaction([
    prisma.college.count(),
    prisma.paper.count({ where: PUBLIC_PAPER_WHERE }),
    prisma.user.count(),
    prisma.paper.findMany({
      where: PUBLIC_PAPER_WHERE,
      distinct: ["uploadedById"],
      select: { uploadedById: true },
    }),
  ]);
  return { colleges, papers, students, contributors: contributorRows.length };
}

export async function topContributors(limit = 5) {
  const grouped = await prisma.paper.groupBy({
    by: ["uploadedById"],
    where: PUBLIC_PAPER_WHERE,
    _count: { _all: true },
    orderBy: { _count: { uploadedById: "desc" } },
    take: limit,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.uploadedById) } },
    select: { id: true, name: true, trustLevel: true },
  });
  return grouped
    .map((g) => {
      const user = users.find((u) => u.id === g.uploadedById);
      return user ? { ...user, papers: g._count._all } : null;
    })
    .filter((x): x is { id: string; name: string; trustLevel: string; papers: number } => !!x);
}

export async function popularColleges(limit = 4) {
  const colleges = await prisma.college.findMany({
    include: { programs: { select: { slug: true, name: true } } },
  });
  const withCounts = await Promise.all(
    colleges.map(async (college) => ({
      ...college,
      papers: await prisma.paper.count({
        where: {
          ...PUBLIC_PAPER_WHERE,
          paperSet: {
            examSession: {
              subject: { semester: { branch: { program: { collegeId: college.id } } } },
            },
          },
        },
      }),
    })),
  );
  return withCounts.sort((a, b) => b.papers - a.papers).slice(0, limit);
}

/**
 * Archive coverage per branch: share of (subject x exam type x recent year)
 * slots that have at least one published paper. Computed from real rows.
 */
export async function branchCoverage(collegeId: string, yearsBack = 3) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: yearsBack }, (_, i) => currentYear - 1 - i);
  const examTypeCount = await prisma.examType.count({ where: { collegeId } });

  const branches = await prisma.branch.findMany({
    where: { archived: false, program: { collegeId, archived: false } },
    include: {
      program: { select: { name: true, slug: true } },
      semesters: { include: { subjects: { where: { archived: false }, select: { id: true } } } },
    },
  });

  return Promise.all(
    branches.map(async (branch) => {
      const subjectIds = branch.semesters.flatMap((s) => s.subjects.map((x) => x.id));
      const slots = subjectIds.length * Math.max(examTypeCount, 1) * years.length;
      if (slots === 0) {
        return { branch, percent: 0, filled: 0, slots: 0 };
      }
      const filledRows = await prisma.paperSet.findMany({
        where: {
          papers: { some: PUBLIC_PAPER_WHERE },
          examSession: { subjectId: { in: subjectIds }, academicYear: { in: years } },
        },
        select: { examSession: { select: { subjectId: true, examTypeId: true, academicYear: true } } },
      });
      const unique = new Set(
        filledRows.map(
          (r) =>
            `${r.examSession.subjectId}|${r.examSession.examTypeId}|${r.examSession.academicYear}`,
        ),
      );
      return {
        branch,
        filled: unique.size,
        slots,
        percent: Math.min(100, Math.round((unique.size / slots) * 100)),
      };
    }),
  );
}
