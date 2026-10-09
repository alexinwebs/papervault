import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function recordAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ? JSON.stringify(input.before) : null,
      after: input.after ? JSON.stringify(input.after) : null,
      reason: input.reason?.slice(0, 1000) ?? null,
    },
  });
  logger.info("audit", {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}

export function recentAudit(limit = 40) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true, role: true } } },
  });
}

/** Paginated, filterable audit trail for /admin/audit. Platform admins only (checked by the caller). */
export async function auditPage(input: { q?: string; entityType?: string; page?: number; pageSize?: number }) {
  const pageSize = Math.min(input.pageSize ?? 50, 100);
  const page = Math.max(1, input.page ?? 1);
  const q = input.q?.trim();
  const where = {
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { entityId: q },
            { actor: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}
