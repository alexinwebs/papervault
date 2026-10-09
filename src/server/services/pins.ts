import { prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { rateLimitAsync } from "@/lib/rate-limit";
import type { SessionUser } from "@/lib/auth";

/**
 * Pinned colleges: a private shortcut list. Every function takes the session
 * user and scopes by that id; no caller can name another user. Pins are never
 * counted or shown publicly and do not feed any ranking.
 */

/** Generous, but stops a script filling the table. */
export const MAX_PINS = 50;

export async function setCollegePin(user: SessionUser, collegeId: string, pinned: boolean) {
  await rateLimitAsync(`pin:${user.id}`, 60, 60_000);

  if (!pinned) {
    // deleteMany scoped by the caller's id: unpinning something that was never
    // pinned (or someone else's) is a silent no-op, not an error.
    await prisma.userPinnedCollege.deleteMany({ where: { userId: user.id, collegeId } });
    return { pinned: false };
  }

  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true } });
  if (!college) throw notFound("College");

  const count = await prisma.userPinnedCollege.count({ where: { userId: user.id } });
  if (count >= MAX_PINS) {
    const already = await prisma.userPinnedCollege.findUnique({
      where: { userId_collegeId: { userId: user.id, collegeId } },
      select: { userId: true },
    });
    if (!already) throw conflict(`You can pin up to ${MAX_PINS} colleges. Unpin one first.`);
  }

  // The composite primary key makes a double click or a replayed request
  // harmless: the second insert is skipped, never duplicated.
  await prisma.userPinnedCollege.createMany({
    data: [{ userId: user.id, collegeId }],
    skipDuplicates: true,
  });
  return { pinned: true };
}

/** The caller's pinned colleges, most recent first, for navigation. */
export function myPinnedColleges(userId: string) {
  return prisma.userPinnedCollege.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_PINS,
    select: {
      createdAt: true,
      college: {
        select: { id: true, slug: true, name: true, shortName: true, city: true, state: true },
      },
    },
  });
}

/** Which of these colleges the caller has pinned, for rendering card states. */
export async function pinnedCollegeIds(userId: string | null | undefined, collegeIds?: string[]) {
  if (!userId) return new Set<string>();
  if (collegeIds && collegeIds.length === 0) return new Set<string>();
  const rows = await prisma.userPinnedCollege.findMany({
    where: { userId, ...(collegeIds ? { collegeId: { in: collegeIds } } : {}) },
    select: { collegeId: true },
    take: MAX_PINS,
  });
  return new Set(rows.map((row) => row.collegeId));
}
