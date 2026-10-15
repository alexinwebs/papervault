import { prisma } from "@/lib/db";
import { availableRequestSlots } from "./request-availability";
import { requestSlotKey } from "@/lib/request-slots";
import { notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import { paperCardInclude } from "../repositories/papers";

export async function toggleBookmark(user: SessionUser, paperId: string) {
  const paper = await prisma.paper.findUnique({ where: { id: paperId }, select: { id: true } });
  if (!paper) throw notFound("Paper");
  const existing = await prisma.bookmark.findUnique({
    where: { userId_paperId: { userId: user.id, paperId } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return { saved: false };
  }
  await prisma.bookmark.create({ data: { userId: user.id, paperId } });
  return { saved: true };
}

export async function myLibrary(userId: string) {
  const [saved, recent, uploads, requests] = await prisma.$transaction([
    prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { paper: { include: paperCardInclude } },
    }),
    prisma.paperView.findMany({
      where: { userId },
      orderBy: { viewedAt: "desc" },
      take: 10,
      include: { paper: { include: paperCardInclude } },
    }),
    prisma.paper.findMany({
      where: { uploadedById: userId, status: { notIn: ["REMOVED"] } },
      orderBy: { createdAt: "desc" },
      include: paperCardInclude,
    }),
    prisma.paperRequest.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "desc" },
      include: {
        examType: true,
        subject: {
          include: {
            semester: { include: { branch: { include: { program: { include: { college: true } } } } } },
          },
        },
      },
    }),
  ]);
  const available = await availableRequestSlots(requests);
  return { saved, recent, uploads, requests: requests.map(request => ({ ...request, fulfilled: available.has(requestSlotKey(request)) })) };
}

export async function contributorProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, trustLevel: true, role: true, createdAt: true, college: true },
  });
  if (!user) throw notFound("Contributor");
  const [published, verified, helpfulReports, history] = await prisma.$transaction([
    prisma.paper.count({ where: { uploadedById: userId, status: "PUBLISHED", restricted: false } }),
    prisma.paper.count({
      where: {
        uploadedById: userId,
        status: "PUBLISHED", restricted: false,
        verification: { in: ["MODERATOR_VERIFIED", "COLLEGE_VERIFIED"] },
      },
    }),
    prisma.report.count({ where: { reportedById: userId, status: "RESOLVED" } }),
    prisma.paper.findMany({
      where: { uploadedById: userId, status: "PUBLISHED", restricted: false },
      include: paperCardInclude,
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
  ]);
  return { user, published, verified, helpfulReports, history };
}
