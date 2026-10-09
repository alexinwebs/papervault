import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import { recordAudit } from "./audit";

/** "Not in the archive yet" demand signal. */
export async function requestPaper(
  user: SessionUser,
  input: { subjectId: string; examTypeId: string; academicYear: number },
) {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) throw notFound("Subject");
  const request = await prisma.paperRequest.upsert({
    where: {
      subjectId_examTypeId_academicYear_requestedById: {
        subjectId: input.subjectId,
        examTypeId: input.examTypeId,
        academicYear: input.academicYear,
        requestedById: user.id,
      },
    },
    create: { ...input, requestedById: user.id },
    update: {},
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

export function requestCount(input: { subjectId: string; examTypeId?: string; academicYear?: number }) {
  return prisma.paperRequest.count({
    where: {
      subjectId: input.subjectId,
      ...(input.examTypeId ? { examTypeId: input.examTypeId } : {}),
      ...(input.academicYear ? { academicYear: input.academicYear } : {}),
      fulfilled: false,
    },
  });
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
