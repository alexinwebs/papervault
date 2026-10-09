import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/lib/auth";

export type InboxItem = Awaited<ReturnType<typeof listInbox>>[number];

/**
 * Writes an in-app notification. Never throws: a failed notification must not
 * roll back the action that caused it.
 */
export async function pushInbox(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
}) {
  try {
    await prisma.inboxMessage.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
      },
    });
  } catch (err) {
    logger.error("inbox_push_failed", { type: input.type, error: String(err) });
  }
}

export function listInbox(userId: string, take = 50) {
  return prisma.inboxMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function unreadCount(userId: string) {
  return prisma.inboxMessage.count({ where: { userId, readAt: null } });
}

export async function markRead(actor: SessionUser, id: string) {
  // Scoped by userId so an id from another account is a silent no-op.
  await prisma.inboxMessage.updateMany({
    where: { id, userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(actor: SessionUser) {
  const result = await prisma.inboxMessage.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
