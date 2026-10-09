import { prisma } from "@/lib/db";

export const PAGE_SIZE = 12;

export function listColleges(input: {
  q?: string;
  state?: string;
  program?: string;
  verifiedOnly?: boolean;
  page?: number;
}) {
  const page = input.page ?? 1;
  const where = {
    AND: [
      input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: "insensitive" as const } },
              { shortName: { contains: input.q, mode: "insensitive" as const } },
              { city: { contains: input.q, mode: "insensitive" as const } },
              { university: { contains: input.q, mode: "insensitive" as const } },
            ],
          }
        : {},
      input.state ? { state: input.state } : {},
      input.verifiedOnly ? { verified: true } : {},
      input.program ? { programs: { some: { slug: input.program, archived: false } } } : {},
    ],
  };

  return prisma.$transaction([
    prisma.college.findMany({
      where,
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { programs: { where: { archived: false }, select: { slug: true, name: true } } },
    }),
    prisma.college.count({ where }),
  ]);
}

export function collegeBySlug(slug: string) {
  return prisma.college.findUnique({
    where: { slug },
    include: {
      programs: {
        where: { archived: false },
        orderBy: { name: "asc" },
        include: { branches: { where: { archived: false }, orderBy: { name: "asc" } } },
      },
      examTypes: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export function collegeStates() {
  return prisma.college.findMany({ distinct: ["state"], select: { state: true }, orderBy: { state: "asc" } });
}

/** Portable published-paper count for one college (works on SQLite and Postgres). */
export function publishedPaperCountForCollege(collegeId: string) {
  return prisma.paper.count({ where: publishedPaperWhereForCollege(collegeId) });
}

export function publishedPaperWhereForCollege(collegeId: string) {
  return {
    status: "PUBLISHED",
    restricted: false,
    paperSet: {
      examSession: {
        subject: { semester: { branch: { program: { collegeId } } } },
      },
    },
  } as const;
}

export function contributorCountForCollege(collegeId: string) {
  return prisma.paper
    .findMany({
      where: publishedPaperWhereForCollege(collegeId),
      distinct: ["uploadedById"],
      select: { uploadedById: true },
    })
    .then((rows) => rows.length);
}
