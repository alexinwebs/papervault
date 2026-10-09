import { prisma } from "@/lib/db";
import { conflict, notFound, validation } from "@/lib/errors";
import { assertVerifiedEmail, type SessionUser } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";
import {
  TEACHER_DOC_MIME,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/constants";
import { assertPlatformAdmin, isPlatformAdmin } from "../authz";
import { recordAudit } from "./audit";
import { notifyAdmins, notifyUser } from "./notifications";
import { inspectPrivateFile, privateStorageKey, type InspectedFile } from "./private-files";

export const TICKET_MAX_FILES = 3;
const CLOSED: TicketStatus[] = ["CLOSED"];
export const OPEN_TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_REVIEW", "WAITING_FOR_USER", "WAITING_FOR_ADMIN"];

type FileInput = { name: string; bytes: Buffer };

export type NewTicket = {
  category: TicketCategory;
  subject: string;
  body: string;
  clientToken?: string | null;
  relatedPaperId?: string | null;
  relatedCommentId?: string | null;
  relatedUserId?: string | null;
  college?: { name: string; university: string; city: string; state: string; website?: string | null };
  subjectRequest?: {
    collegeId: string;
    programId?: string | null;
    branchId?: string | null;
    semesterId?: string | null;
    subjectName: string;
    subjectCode?: string | null;
  };
};

/* ------------------------------------------------------------------------ */
/* Numbering                                                                */
/* ------------------------------------------------------------------------ */

/**
 * PV-2026-000001. One row per year, incremented with a single atomic
 * upsert, so concurrent tickets can never share a number.
 */
export async function nextTicketNumber(now = new Date()) {
  const year = now.getUTCFullYear();
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO "TicketCounter" ("year", "value") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "value" = "TicketCounter"."value" + 1
    RETURNING "value"`;
  const value = Number(rows[0]?.value ?? 1);
  return `PV-${year}-${String(value).padStart(6, "0")}`;
}

/* ------------------------------------------------------------------------ */
/* Attachments                                                              */
/* ------------------------------------------------------------------------ */

async function inspectAttachments(files: FileInput[]) {
  if (files.length > TICKET_MAX_FILES) throw validation(`Attach at most ${TICKET_MAX_FILES} files.`);
  const out: InspectedFile[] = [];
  for (const file of files) {
    out.push(
      await inspectPrivateFile(file, {
        maxBytes: TICKET_ATTACHMENT_MAX_BYTES,
        allowed: TEACHER_DOC_MIME,
        label: file.name || "Attachment",
      }),
    );
  }
  return out;
}

async function storeAttachments(ticketId: string, messageId: string, uploadedById: string, files: InspectedFile[]) {
  const written: string[] = [];
  try {
    for (const file of files) {
      const key = privateStorageKey("tickets", ticketId, file.extension);
      await storage().put({ key, body: file.bytes, contentType: file.mime });
      written.push(key);
      await prisma.ticketAttachment.create({
        data: {
          ticketId,
          messageId,
          uploadedById,
          storageKey: key,
          originalName: file.originalName,
          mimeType: file.mime,
          sizeBytes: file.bytes.byteLength,
          sha256: file.sha256,
        },
      });
    }
  } catch (err) {
    for (const key of written) await storage().delete(key).catch(() => undefined);
    await prisma.ticketAttachment.deleteMany({ where: { storageKey: { in: written } } }).catch(() => undefined);
    throw err;
  }
}

/* ------------------------------------------------------------------------ */
/* Requester side                                                           */
/* ------------------------------------------------------------------------ */

async function validateRelated(input: NewTicket) {
  if (input.relatedPaperId) {
    const paper = await prisma.paper.findUnique({ where: { id: input.relatedPaperId }, select: { id: true } });
    if (!paper) throw validation("That paper could not be found.");
  }
  if (input.relatedCommentId) {
    const c = await prisma.comment.findUnique({ where: { id: input.relatedCommentId }, select: { id: true } });
    if (!c) throw validation("That comment could not be found.");
  }
  if (input.relatedUserId) {
    const u = await prisma.user.findUnique({ where: { id: input.relatedUserId }, select: { id: true } });
    if (!u) throw validation("That member could not be found.");
  }
}

/** Normalised for duplicate checks: case, punctuation and spacing ignored. */
export function normaliseName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function assertCollegeNotListed(name: string) {
  const target = normaliseName(name);
  const candidates = await prisma.college.findMany({
    where: { name: { contains: name.trim().split(/\s+/)[0] ?? name, mode: "insensitive" } },
    select: { name: true, shortName: true },
    take: 50,
  });
  const hit = candidates.find((c) => normaliseName(c.name) === target || normaliseName(c.shortName) === target);
  if (hit) throw conflict(`${hit.name} is already on PaperVault.`);
  const pending = await prisma.collegeRequest.findMany({
    where: { status: { in: ["REQUESTED", "NEEDS_INFORMATION"] } },
    select: { name: true },
  });
  if (pending.some((p) => normaliseName(p.name) === target)) {
    throw conflict("Someone has already requested this college. It's in the review queue.");
  }
}

async function assertSubjectRequestValid(s: NonNullable<NewTicket["subjectRequest"]>) {
  const college = await prisma.college.findUnique({ where: { id: s.collegeId }, select: { id: true } });
  if (!college) throw validation("Choose the college this subject belongs to.");
  if (s.semesterId) {
    const sem = await prisma.semester.findUnique({
      where: { id: s.semesterId },
      select: { id: true, branch: { select: { program: { select: { collegeId: true } } } } },
    });
    if (!sem || sem.branch.program.collegeId !== s.collegeId) throw validation("That semester isn't part of the chosen college.");
    const target = normaliseName(s.subjectName);
    const existing = await prisma.subject.findMany({ where: { semesterId: s.semesterId }, select: { name: true, code: true } });
    const hit = existing.find(
      (e) => normaliseName(e.name) === target || (s.subjectCode && e.code.toUpperCase() === s.subjectCode.toUpperCase()),
    );
    if (hit) throw conflict(`${hit.name} (${hit.code}) is already listed for that semester.`);
  }
  const pending = await prisma.subjectRequest.findMany({
    where: { collegeId: s.collegeId, status: { in: ["REQUESTED", "NEEDS_INFORMATION"] } },
    select: { subjectName: true, semesterId: true },
  });
  if (pending.some((p) => normaliseName(p.subjectName) === normaliseName(s.subjectName) && p.semesterId === (s.semesterId ?? null))) {
    throw conflict("This subject has already been requested and is waiting for review.");
  }
}

export async function createTicket(user: SessionUser, input: NewTicket, files: FileInput[], ip: string | null) {
  assertVerifiedEmail(user, { allowRestricted: true });
  await rateLimitAsync(`ticket:user:${user.id}`, 5, 60 * 60_000);
  await rateLimitAsync(`ticket:user-day:${user.id}`, 20, 24 * 60 * 60_000);
  if (ip) await rateLimitAsync(`ticket:ip:${ip}`, 20, 60 * 60_000);

  if (input.category === "ADD_COLLEGE") {
    if (!input.college) throw validation("Tell us the college's name, university and location.");
    await assertCollegeNotListed(input.college.name);
  }
  if (input.category === "ADD_SUBJECT") {
    if (!input.subjectRequest) throw validation("Tell us the subject and the college it belongs to.");
    await assertSubjectRequestValid(input.subjectRequest);
  }
  if (input.relatedUserId && input.relatedUserId === user.id) throw validation("You can't report yourself.");
  await validateRelated(input);
  const inspected = await inspectAttachments(files);

  const number = await nextTicketNumber();
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        number,
        requesterId: user.id,
        category: input.category,
        subject: input.subject,
        relatedPaperId: input.relatedPaperId || null,
        relatedCommentId: input.relatedCommentId || null,
        relatedUserId: input.relatedUserId || null,
        priority: input.category === "COPYRIGHT" || input.category === "REPORT_PAPER" ? "HIGH" : "NORMAL",
        events: { create: { actorId: user.id, type: "created", toValue: "OPEN" } },
      },
    });
    const message = await tx.ticketMessage.create({
      data: { ticketId: created.id, authorId: user.id, body: input.body, clientToken: input.clientToken || null },
    });
    if (input.category === "ADD_COLLEGE" && input.college) {
      await tx.collegeRequest.create({
        data: {
          ticketId: created.id,
          requestedById: user.id,
          name: input.college.name,
          university: input.college.university,
          city: input.college.city,
          state: input.college.state,
          website: input.college.website || null,
          details: input.body,
        },
      });
    }
    if (input.category === "ADD_SUBJECT" && input.subjectRequest) {
      const s = input.subjectRequest;
      await tx.subjectRequest.create({
        data: {
          ticketId: created.id,
          requestedById: user.id,
          collegeId: s.collegeId,
          programId: s.programId || null,
          branchId: s.branchId || null,
          semesterId: s.semesterId || null,
          subjectName: s.subjectName,
          subjectCode: s.subjectCode ? s.subjectCode.toUpperCase() : null,
          details: input.body,
        },
      });
    }
    return { ...created, firstMessageId: message.id };
  });

  if (inspected.length) {
    try {
      await storeAttachments(ticket.id, ticket.firstMessageId, user.id, inspected);
    } catch (err) {
      await prisma.supportTicket.delete({ where: { id: ticket.id } }).catch(() => undefined);
      throw err;
    }
  }

  await recordAudit({
    actorId: user.id,
    action: "ticket.created",
    entityType: "SupportTicket",
    entityId: ticket.id,
    after: { number, category: input.category },
  });
  await notifyUser({
    userId: user.id,
    type: "ticket.created",
    title: `${number} received`,
    body: `We've received your ${TICKET_CATEGORY_LABEL[input.category].toLowerCase()} request "${input.subject}". You can follow it under My tickets.`,
    href: `/my-tickets/${ticket.id}`,
  });
  await notifyAdmins({
    type: `ticket.${input.category.toLowerCase()}`,
    caseId: number,
    title: `New ticket: ${TICKET_CATEGORY_LABEL[input.category]}`,
    summary: input.subject,
    href: `/admin/tickets/${ticket.id}`,
    member: user.name,
  });
  return ticket;
}

export function myTickets(user: SessionUser) {
  return prisma.supportTicket.findMany({
    where: { requesterId: user.id },
    orderBy: { lastActivityAt: "desc" },
    take: 100,
    select: { id: true, number: true, subject: true, category: true, status: true, lastActivityAt: true, createdAt: true },
  });
}

/**
 * The requester's view. Anyone else gets "not found" (not "forbidden") so
 * ticket ids can't be probed. Internal notes are filtered in the query, not
 * in the page, so they can never reach the browser.
 */
export async function ticketForRequester(user: SessionUser, ticketId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, requesterId: user.id },
    select: {
      id: true,
      number: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      collegeRequest: { select: { status: true, decisionNote: true, createdCollegeId: true } },
      subjectRequest: { select: { status: true, decisionNote: true, createdSubjectId: true } },
      messages: {
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          authorId: true,
          author: { select: { name: true, role: true } },
          attachments: { select: { id: true, originalName: true, sizeBytes: true, mimeType: true } },
        },
      },
    },
  });
  if (!ticket) throw notFound("Ticket");
  return {
    ...ticket,
    messages: ticket.messages.map((m) => ({
      ...m,
      fromStaff: m.authorId !== user.id,
      // Staff names are not exposed to members; they see "PaperVault team".
      authorName: m.authorId === user.id ? "You" : "PaperVault team",
      author: undefined,
    })),
  };
}

async function postMessage(input: {
  ticketId: string;
  authorId: string;
  body: string;
  internal: boolean;
  clientToken?: string | null;
}) {
  try {
    return await prisma.ticketMessage.create({
      data: {
        ticketId: input.ticketId,
        authorId: input.authorId,
        body: input.body,
        internal: input.internal,
        clientToken: input.clientToken || null,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      // Same form submitted twice: return the message that already exists.
      const existing = await prisma.ticketMessage.findFirst({
        where: { ticketId: input.ticketId, clientToken: input.clientToken ?? undefined },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

export async function replyAsRequester(
  user: SessionUser,
  input: { ticketId: string; body: string; clientToken?: string | null },
  files: FileInput[],
) {
  assertVerifiedEmail(user, { allowRestricted: true });
  await rateLimitAsync(`ticket-reply:user:${user.id}`, 30, 60 * 60_000);
  const ticket = await prisma.supportTicket.findFirst({ where: { id: input.ticketId, requesterId: user.id } });
  if (!ticket) throw notFound("Ticket");
  if (CLOSED.includes(ticket.status as TicketStatus)) {
    throw conflict("This ticket is closed. Open a new ticket if you still need help.");
  }
  const inspected = await inspectAttachments(files);
  const message = await postMessage({ ticketId: ticket.id, authorId: user.id, body: input.body, internal: false, clientToken: input.clientToken });
  if (inspected.length) await storeAttachments(ticket.id, message.id, user.id, inspected);
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "WAITING_FOR_ADMIN", lastActivityAt: new Date(), resolvedAt: null },
  });
  if (ticket.status !== "WAITING_FOR_ADMIN") {
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: user.id, type: "status", fromValue: ticket.status, toValue: "WAITING_FOR_ADMIN" },
    });
  }
  await notifyAdmins({
    type: "ticket.reply",
    caseId: ticket.number,
    title: "Member replied",
    summary: ticket.subject,
    href: `/admin/tickets/${ticket.id}`,
    member: user.name,
  });
  return message;
}

export async function closeTicketAsRequester(user: SessionUser, ticketId: string) {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, requesterId: user.id } });
  if (!ticket) throw notFound("Ticket");
  if (ticket.status === "CLOSED") return ticket;
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "CLOSED", closedAt: new Date(), lastActivityAt: new Date() },
  });
  await prisma.ticketEvent.create({
    data: { ticketId: ticket.id, actorId: user.id, type: "status", fromValue: ticket.status, toValue: "CLOSED" },
  });
  await recordAudit({ actorId: user.id, action: "ticket.closed_by_requester", entityType: "SupportTicket", entityId: ticket.id });
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Attachments (download)                                                   */
/* ------------------------------------------------------------------------ */

/** Requester (non-internal message only) or platform admin. Others: not found. */
export async function openTicketAttachment(user: SessionUser, attachmentId: string) {
  const att = await prisma.ticketAttachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: { select: { requesterId: true, id: true } }, message: { select: { internal: true } } },
  });
  if (!att) throw notFound("Attachment");
  const admin = isPlatformAdmin(user.role);
  if (admin) assertPlatformAdmin(user);
  const owner = att.ticket.requesterId === user.id && !att.message?.internal;
  if (!admin && !owner) throw notFound("Attachment");
  if (admin && !owner) {
    await recordAudit({
      actorId: user.id,
      action: "ticket.attachment_accessed",
      entityType: "TicketAttachment",
      entityId: att.id,
      after: { ticketId: att.ticket.id },
    });
  }
  const signed = await storage().signedUrl(att.storageKey, 60);
  if (signed) return { kind: "redirect" as const, url: signed };
  return { kind: "bytes" as const, bytes: await storage().get(att.storageKey), mime: att.mimeType, filename: att.originalName };
}

/* ------------------------------------------------------------------------ */
/* Admin side                                                               */
/* ------------------------------------------------------------------------ */

export async function adminTicketList(
  actor: SessionUser,
  input: { status?: string; category?: string; priority?: string; q?: string; mine?: boolean; page?: number },
) {
  assertPlatformAdmin(actor);
  const pageSize = 25;
  const page = Math.max(1, input.page ?? 1);
  const where = {
    ...(input.status === "ALL"
      ? {}
      : input.status
        ? { status: input.status }
        : { status: { in: OPEN_TICKET_STATUSES as string[] } }),
    ...(input.category ? { category: input.category } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.mine ? { assigneeId: actor.id } : {}),
    ...(input.q
      ? {
          OR: [
            { number: { contains: input.q, mode: "insensitive" as const } },
            { subject: { contains: input.q, mode: "insensitive" as const } },
            { requester: { email: { contains: input.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [rows, total, counts] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      // Urgent first, then the ones waiting longest.
      orderBy: [{ lastActivityAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        subject: true,
        category: true,
        status: true,
        priority: true,
        lastActivityAt: true,
        createdAt: true,
        requester: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  rows.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
  return {
    rows,
    total,
    page,
    pageSize,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
  };
}

export async function adminTicketDetail(actor: SessionUser, ticketId: string) {
  assertPlatformAdmin(actor);
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      requester: { select: { id: true, name: true, email: true, role: true, status: true } },
      assignee: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, role: true } },
          attachments: { select: { id: true, originalName: true, sizeBytes: true, mimeType: true } },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      collegeRequest: true,
      subjectRequest: {
        include: {
          college: { select: { id: true, name: true, shortName: true } },
          semester: { select: { id: true, number: true, branch: { select: { name: true, program: { select: { name: true } } } } } },
        },
      },
    },
  });
  if (!ticket) return null;
  const [admins, relatedPaper, relatedUser, relatedComment] = await Promise.all([
    prisma.user.findMany({ where: { role: "PLATFORM_ADMIN", anonymizedAt: null }, select: { id: true, name: true } }),
    ticket.relatedPaperId
      ? prisma.paper.findUnique({ where: { id: ticket.relatedPaperId }, select: { id: true, title: true, status: true } })
      : null,
    ticket.relatedUserId
      ? prisma.user.findUnique({ where: { id: ticket.relatedUserId }, select: { id: true, name: true, status: true } })
      : null,
    ticket.relatedCommentId
      ? prisma.comment.findUnique({ where: { id: ticket.relatedCommentId }, select: { id: true, body: true, paperId: true } })
      : null,
  ]);
  return { ...ticket, admins, relatedPaper, relatedUser, relatedComment };
}

export async function adminReply(
  actor: SessionUser,
  input: { ticketId: string; body: string; internal: boolean; clientToken?: string | null; status?: TicketStatus | "" },
) {
  assertPlatformAdmin(actor);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) throw notFound("Ticket");
  await postMessage({ ticketId: ticket.id, authorId: actor.id, body: input.body, internal: input.internal, clientToken: input.clientToken });
  if (input.internal) {
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { lastActivityAt: new Date() } });
    return;
  }
  const next: TicketStatus = input.status || "WAITING_FOR_USER";
  await applyStatus(actor, ticket, next);
  await notifyUser({
    userId: ticket.requesterId,
    type: "ticket.reply",
    title: `Update on ${ticket.number}`,
    body: `The PaperVault team replied to "${ticket.subject}". Status: ${TICKET_STATUS_LABEL[next]}.`,
    href: `/my-tickets/${ticket.id}`,
  });
}

async function applyStatus(actor: SessionUser, ticket: { id: string; status: string }, next: TicketStatus) {
  const now = new Date();
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: next,
      lastActivityAt: now,
      resolvedAt: next === "RESOLVED" ? now : next === "CLOSED" ? undefined : null,
      closedAt: next === "CLOSED" ? now : null,
    },
  });
  if (ticket.status !== next) {
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "status", fromValue: ticket.status, toValue: next },
    });
  }
}

export async function updateTicket(
  actor: SessionUser,
  input: { ticketId: string; status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null },
) {
  assertPlatformAdmin(actor);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) throw notFound("Ticket");
  const changes: Record<string, { from: string | null; to: string | null }> = {};

  if (input.status && input.status !== ticket.status) {
    await applyStatus(actor, ticket, input.status);
    changes.status = { from: ticket.status, to: input.status };
    if (input.status === "RESOLVED" || input.status === "CLOSED") {
      await notifyUser({
        userId: ticket.requesterId,
        type: "ticket.status",
        title: `${ticket.number} ${TICKET_STATUS_LABEL[input.status].toLowerCase()}`,
        body: `Your ticket "${ticket.subject}" is now ${TICKET_STATUS_LABEL[input.status].toLowerCase()}.`,
        href: `/my-tickets/${ticket.id}`,
      });
    }
  }
  if (input.priority && input.priority !== ticket.priority) {
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { priority: input.priority } });
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "priority", fromValue: ticket.priority, toValue: input.priority },
    });
    changes.priority = { from: ticket.priority, to: input.priority };
  }
  if (input.assigneeId !== undefined && (input.assigneeId || null) !== ticket.assigneeId) {
    const assigneeId = input.assigneeId || null;
    if (assigneeId) {
      const target = await prisma.user.findUnique({ where: { id: assigneeId }, select: { role: true } });
      if (!target || target.role !== "PLATFORM_ADMIN") throw validation("Tickets can only be assigned to a platform admin.");
    }
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { assigneeId } });
    await prisma.ticketAssignment.create({ data: { ticketId: ticket.id, assigneeId, assignedById: actor.id } });
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "assigned", fromValue: ticket.assigneeId, toValue: assigneeId },
    });
    changes.assignee = { from: ticket.assigneeId, to: assigneeId };
  }
  if (Object.keys(changes).length) {
    await recordAudit({
      actorId: actor.id,
      action: "ticket.updated",
      entityType: "SupportTicket",
      entityId: ticket.id,
      before: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
      after: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
    });
  }
  return changes;
}
