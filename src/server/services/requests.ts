import { prisma } from "@/lib/db";
import { notFound, validation } from "@/lib/errors";
import { assertVerifiedEmail, type SessionUser } from "@/lib/auth";
import { availableRequestSlots } from "./request-availability";
import { requestSlotKey } from "@/lib/request-slots";
import { recordAudit } from "./audit";

/** "Not in the archive yet" demand signal. */
export async function requestPaper(
  user: SessionUser,
  input: { subjectId: string; examTypeId: string; academicYear: number },
) {
  assertVerifiedEmail(user);
  const subject = await prisma.subject.findFirst({
    where: { id: input.subjectId, archived: false, semester: { branch: { archived: false, program: { archived: false } } } },
    select: { semester: { select: { branch: { select: { program: { select: { collegeId: true } } } } } } },
  });
  if (!subject) throw notFound("Subject");
  const examType = await prisma.examType.findFirst({ where: { id: input.examTypeId, collegeId: subject.semester.branch.program.collegeId } });
  if (!examType) throw validation("Choose an exam type from this subject's college.");
  if (!Number.isInteger(input.academicYear) || input.academicYear < 1990 || input.academicYear > new Date().getFullYear())
    throw validation("Request a past or released paper, not an upcoming exam.");
  const available = await availableRequestSlots([input]);
  const fulfilled = available.has(requestSlotKey(input));
  const request = await prisma.paperRequest.upsert({
    where: {
      subjectId_examTypeId_academicYear_requestedById: {
        subjectId: input.subjectId,
        examTypeId: input.examTypeId,
        academicYear: input.academicYear,
        requestedById: user.id,
      },
    },
    create: { ...input, requestedById: user.id, fulfilled },
    update: { fulfilled },
  });
  await recordAudit({
    actorId: user.id,
    action: "paper.requested",
    entityType: "Subject",
    entityId: input.subjectId,
    after: { examTypeId: input.examTypeId, academicYear: input.academicYear },
  });
  return request;
}

export async function requestCount(input: { subjectId: string; examTypeId?: string; academicYear?: number }) {
  const groups = await prisma.paperRequest.groupBy({
    by: ["subjectId", "examTypeId", "academicYear"],
    where: { subjectId: input.subjectId, ...(input.examTypeId ? { examTypeId: input.examTypeId } : {}), ...(input.academicYear ? { academicYear: input.academicYear } : {}) },
    _count: { _all: true },
  });
  const available = await availableRequestSlots(groups);
  return groups.reduce((total, row) => total + (available.has(requestSlotKey(row)) ? 0 : row._count._all), 0);
}

export function topRequests(limit = 10) {
  return prisma.paperRequest.groupBy({
    by: ["subjectId", "examTypeId", "academicYear"],
    where: { fulfilled: false },
    _count: { _all: true },
    orderBy: { _count: { subjectId: "desc" } },
    take: limit,
  });
}

/** Public, aggregate-only demand board. Bounds the candidate scan; never exposes names/emails. */
export async function wantedPapers(collegeSlug?: string) {
  const groups = await prisma.paperRequest.groupBy({
    by: ["subjectId", "examTypeId", "academicYear"],
    where: {
      academicYear: { lte: new Date().getFullYear() },
      subject: { archived: false, semester: { branch: { archived: false, program: { archived: false, ...(collegeSlug ? { college: { slug: collegeSlug } } : {}) } } } },
    },
    _count: { _all: true },
    orderBy: [{ _count: { subjectId: "desc" } }, { subjectId: "asc" }, { examTypeId: "asc" }, { academicYear: "desc" }],
    take: 100,
  });
  const [available, subjects, exams] = await Promise.all([
    availableRequestSlots(groups),
    prisma.subject.findMany({ where: { id: { in: groups.map(g => g.subjectId) } }, include: { semester: { include: { branch: { include: { program: { include: { college: true } } } } } } } }),
    prisma.examType.findMany({ where: { id: { in: groups.map(g => g.examTypeId) } } }),
  ]);
  return groups.filter(g => !available.has(requestSlotKey(g))).flatMap(group => {
    const subject = subjects.find(s => s.id === group.subjectId);
    const examType = exams.find(e => e.id === group.examTypeId);
    if (!subject || !examType || examType.collegeId !== subject.semester.branch.program.collegeId) return [];
    return [{ subject, examType, academicYear: group.academicYear, requests: group._count._all }];
  });
}
