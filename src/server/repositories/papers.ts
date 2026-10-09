import { prisma } from "@/lib/db";

export const PUBLIC_PAPER_WHERE = { status: "PUBLISHED", restricted: false } as const;

export const paperCardInclude = {
  files: { select: { id: true, mimeType: true, sizeBytes: true, pageCount: true } },
  uploadedBy: { select: { id: true, name: true, trustLevel: true } },
  paperSet: {
    include: {
      examSession: {
        include: {
          examType: true,
          subject: {
            include: {
              semester: {
                include: { branch: { include: { program: { include: { college: true } } } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function publicPapersForSubject(subjectId: string, examTypeCode?: string) {
  return prisma.paper.findMany({
    where: {
      ...PUBLIC_PAPER_WHERE,
      paperSet: {
        examSession: {
          subjectId,
          ...(examTypeCode ? { examType: { code: examTypeCode } } : {}),
        },
      },
    },
    include: paperCardInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

export function paperById(id: string) {
  return prisma.paper.findUnique({
    where: { id },
    include: {
      ...paperCardInclude,
      reviewedBy: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" } },
      reports: { select: { id: true, reason: true, status: true, createdAt: true } },
    },
  });
}

export function recentPublishedPapers(limit = 6) {
  return prisma.paper.findMany({
    where: PUBLIC_PAPER_WHERE,
    include: paperCardInclude,
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export function relatedPapers(paperId: string, subjectId: string, limit = 5) {
  return prisma.paper.findMany({
    where: {
      ...PUBLIC_PAPER_WHERE,
      id: { not: paperId },
      paperSet: { examSession: { subjectId } },
    },
    include: paperCardInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Moderation queue, scoped to a college unless the actor is a platform admin. */
export function moderationQueue(input: {
  collegeId?: string | null;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = input.pageSize ?? 20;
  const page = input.page ?? 1;
  const where = {
    AND: [
      input.status
        ? { status: input.status }
        : { status: { in: ["SUBMITTED", "PENDING_REVIEW", "CHANGES_REQUESTED", "RESTRICTED"] } },
      input.q ? { title: { contains: input.q, mode: "insensitive" as const } } : {},
      input.collegeId
        ? {
            paperSet: {
              examSession: {
                subject: {
                  semester: { branch: { program: { collegeId: input.collegeId } } },
                },
              },
            },
          }
        : {},
    ],
  };

  return prisma.$transaction([
    prisma.paper.findMany({
      where,
      include: { ...paperCardInclude, reports: { where: { status: "OPEN" }, select: { id: true } } },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paper.count({ where }),
  ]);
}
