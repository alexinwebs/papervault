import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parsePaperSearch, subjectSearchTerms } from "@/lib/search-query";
import { PUBLIC_PAPER_WHERE, paperCardInclude } from "../repositories/papers";

export type SearchResults = Awaited<ReturnType<typeof searchEverything>>;

/** Resolve dimensions, then apply every remaining subject term within those dimensions.
 * UI suggestions are capped; paper results are NOT limited to those suggestion IDs. */
export async function searchEverything(rawQuery: string, page = 1, pageSize = 20) {
  const query = rawQuery.trim().slice(0, 200);
  const { tokens, words, years } = parsePaperSearch(query);
  const [suggestedColleges, examTypes, branches, exactColleges] = await Promise.all([
    words.length ? prisma.college.findMany({
      where: { OR: words.flatMap(token => [
        { name: { contains: token, mode: "insensitive" as const } },
        { shortName: { equals: token, mode: "insensitive" as const } },
      ]) },
      take: 5, orderBy: { name: "asc" },
      include: { programs: { select: { slug: true, name: true } } },
    }) : Promise.resolve([]),
    words.length ? prisma.examType.findMany({
      where: { OR: words.map(token => ({ code: { equals: token, mode: "insensitive" as const } })) },
      select: { id: true, code: true },
    }) : Promise.resolve([]),
    words.length ? prisma.branch.findMany({
      where: { archived: false, program: { archived: false }, OR: words.map(token => ({ code: { equals: token, mode: "insensitive" as const } })) },
      select: { id: true, code: true },
    }) : Promise.resolve([]),
    words.length ? prisma.college.findMany({
      where: { OR: words.map(token => ({ shortName: { equals: token, mode: "insensitive" as const } })) },
      take: 20, orderBy: { name: "asc" }, include: { programs: { select: { slug: true, name: true } } },
    }) : Promise.resolve([]),
  ]);
  const colleges = [...new Map([...exactColleges, ...suggestedColleges].map(c => [c.id, c])).values()].slice(0, 5);
  const scopedColleges = [...new Map([...exactColleges, ...suggestedColleges].map(c => [c.id, c])).values()].filter(college =>
    words.some(word => word.toLowerCase() === college.shortName.toLowerCase()) ||
    query.toLowerCase().includes(college.name.toLowerCase()));
  const collegeWords = new Set(scopedColleges.filter(college => query.toLowerCase().includes(college.name.toLowerCase())).flatMap(college => college.name.toLowerCase().split(/\s+/)));
  const subjectWords = words.filter(token =>
    !examTypes.some(e => e.code.toLowerCase() === token.toLowerCase()) &&
    !branches.some(b => b.code.toLowerCase() === token.toLowerCase()) &&
    !scopedColleges.some(c => c.shortName.toLowerCase() === token.toLowerCase()) &&
    !collegeWords.has(token.toLowerCase()));
  // All explicit scopes apply together; choosing CSE must not discard the college scope.
  const subjectCriteria: Prisma.SubjectWhereInput = {
    archived: false,
    semester: { branch: {
      archived: false,
      ...(branches.length ? { id: { in: branches.map(b => b.id) } } : {}),
      program: { archived: false, ...(scopedColleges.length ? { collegeId: { in: scopedColleges.map(c => c.id) } } : {}) },
    } },
    ...(subjectWords.length ? { AND: subjectWords.map(token => ({
      OR: subjectSearchTerms(token).flatMap(term => [
        { name: { contains: term, mode: "insensitive" as const } },
        { code: { contains: term, mode: "insensitive" as const } },
      ]),
    })) } : {}),
  };
  const subjects = query ? await prisma.subject.findMany({
    where: subjectCriteria, take: 8, orderBy: [{ name: "asc" }, { id: "asc" }],
    include: { semester: { include: { branch: { include: { program: { include: { college: true } } } } } } },
  }) : [];
  const slot: Prisma.ExamSessionWhereInput = {
    ...(examTypes.length ? { examTypeId: { in: examTypes.map(e => e.id) } } : {}),
    ...(years.length ? { academicYear: { in: years } } : {}),
  };
  const scoped = scopedColleges.length > 0 || branches.length > 0 || examTypes.length > 0 || years.length > 0 || subjects.length > 0;
  const where: Prisma.PaperWhereInput = !query ? PUBLIC_PAPER_WHERE : scoped ? {
    ...PUBLIC_PAPER_WHERE,
    OR: [
      { paperSet: { examSession: { ...slot, subject: subjectCriteria } } },
      { listings: { some: { subject: subjectCriteria } }, paperSet: { examSession: slot } },
    ],
  } : {
    ...PUBLIC_PAPER_WHERE,
    // No partial first-word title matches: every term must be present in the
    // title/text combination when hierarchy lookup cannot resolve the query.
    AND: (words.length ? words : [query]).map(word => ({ OR: [
      { title: { contains: word, mode: "insensitive" } },
      { extractedText: { contains: word, mode: "insensitive" } },
    ] })),
  };
  const size = Math.max(1, Math.min(50, Math.floor(pageSize) || 20));
  const paperTotal = await prisma.paper.count({ where });
  const pages = Math.max(1, Math.ceil(paperTotal / size));
  const currentPage = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  const papers = await prisma.paper.findMany({
    where, include: paperCardInclude,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (currentPage - 1) * size, take: size,
  });
  return { query, colleges, subjects, papers, paperTotal, tokens, page: currentPage, pageSize: size, pages };
}
