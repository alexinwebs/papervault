import { prisma } from "@/lib/db";
import { PUBLIC_PAPER_WHERE, paperCardInclude } from "../repositories/papers";

/**
 * Search abstraction.
 *
 * V1 resolves a free-text query into the archive's real dimensions —
 * college, branch, subject, exam type, year — and only then filters papers on
 * indexed foreign keys. That keeps the paper query flat and portable (deeply
 * nested relation OR-filters blow past SQLite's 64-table join limit and are
 * slow on Postgres too).
 *
 * Later tiers (OCR text, question-level index, embeddings) plug in behind this
 * same function without touching call sites.
 */
export type SearchResults = Awaited<ReturnType<typeof searchEverything>>;

function tokenize(query: string) {
  return query
    .split(/[\s,·/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .slice(0, 8);
}

export async function searchEverything(rawQuery: string, page = 1, pageSize = 20) {
  const query = rawQuery.trim();
  if (!query) {
    return { query, colleges: [], subjects: [], papers: [], paperTotal: 0, tokens: [] as string[] };
  }
  const tokens = tokenize(query);
  const words = tokens.filter((token) => !/^\d{4}$/.test(token));
  const years = tokens.filter((token) => /^\d{4}$/.test(token)).map(Number);

  // 1. Dimensions the query mentions.
  const [colleges, examTypes, branches] = await Promise.all([
    prisma.college.findMany({
      where: {
        OR: words.flatMap((token) => [
          { name: { contains: token, mode: "insensitive" as const } },
          { shortName: { contains: token, mode: "insensitive" as const } },
          { university: { contains: token, mode: "insensitive" as const } },
          { city: { contains: token, mode: "insensitive" as const } },
        ]),
      },
      take: 5,
      include: { programs: { select: { slug: true, name: true } } },
    }),
    prisma.examType.findMany({
      where: {
        OR: words.flatMap((token) => [{ code: { contains: token, mode: "insensitive" as const } }, { name: { contains: token, mode: "insensitive" as const } }]),
      },
      select: { id: true, code: true },
    }),
    prisma.branch.findMany({
      where: { archived: false, OR: words.map((token) => ({ code: { equals: token } })) },
      select: { id: true },
      take: 50,
    }),
  ]);

  const collegeIds = colleges.map((college) => college.id);
  const examTypeIds = examTypes.map((examType) => examType.id);
  const branchIds = branches.map((branch) => branch.id);

  // 2. Subjects, narrowed by any college or branch the query named.
  const subjectWords = words.filter(
    (token) =>
      !examTypes.some((examType) => examType.code.toLowerCase() === token.toLowerCase()) &&
      !colleges.some((college) => college.shortName.toLowerCase() === token.toLowerCase()),
  );

  const subjects = await prisma.subject.findMany({
    where: {
      archived: false,
      ...(subjectWords.length > 0
        ? {
            OR: subjectWords.flatMap((token) => [
              { name: { contains: token, mode: "insensitive" as const } },
              { code: { contains: token, mode: "insensitive" as const } },
            ]),
          }
        : {}),
      ...(branchIds.length > 0 ? { semester: { branchId: { in: branchIds } } } : {}),
      ...(collegeIds.length > 0 && branchIds.length === 0
        ? { semester: { branch: { program: { collegeId: { in: collegeIds } } } } }
        : {}),
    },
    take: 200,
    orderBy: { name: "asc" },
    include: {
      semester: { include: { branch: { include: { program: { include: { college: true } } } } } },
    },
  });

  // 3. Flat paper filter on resolved ids.
  const sessionFilter: Record<string, unknown> = {};
  if (subjects.length > 0 && subjectWords.length > 0) {
    sessionFilter.subjectId = { in: subjects.map((subject) => subject.id) };
  } else if (branchIds.length > 0) {
    sessionFilter.subject = { semester: { branchId: { in: branchIds } } };
  } else if (collegeIds.length > 0) {
    sessionFilter.subject = {
      semester: { branch: { program: { collegeId: { in: collegeIds } } } },
    };
  }
  if (examTypeIds.length > 0) sessionFilter.examTypeId = { in: examTypeIds };
  if (years.length > 0) sessionFilter.academicYear = { in: years };

  const matchedSomething = Object.keys(sessionFilter).length > 0;
  // When the query does not resolve to anything in the hierarchy, fall back to
  // the paper title and the text layer extracted from the PDF at upload time,
  // so a phrase from inside a paper still finds it.
  const freeText = (words.length > 0 ? words : [query]).filter((word) => word.length >= 3);
  const paperWhere = matchedSomething
    ? { ...PUBLIC_PAPER_WHERE, paperSet: { examSession: sessionFilter } }
    : {
        ...PUBLIC_PAPER_WHERE,
        OR: [
          { title: { contains: words[0] ?? query, mode: "insensitive" as const } },
          ...(freeText.length > 0
            ? [{ AND: freeText.map((word) => ({ extractedText: { contains: word, mode: "insensitive" as const } })) }]
            : []),
        ],
      };

  const [papers, paperTotal] = await prisma.$transaction([
    prisma.paper.findMany({
      where: paperWhere,
      include: paperCardInclude,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paper.count({ where: paperWhere }),
  ]);

  return { query, colleges, subjects: subjects.slice(0, 8), papers, paperTotal, tokens };
}
