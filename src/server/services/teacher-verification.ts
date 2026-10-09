import { prisma } from "@/lib/db";
import { AppError, conflict, forbidden, notFound, validation } from "@/lib/errors";
import { assertVerifiedEmail, type SessionUser } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import {
  OPEN_TEACHER_STATUSES,
  TEACHER_DOC_MAX_BYTES,
  TEACHER_DOC_MAX_FILES,
  TEACHER_DOC_MIME,
  type TeacherVerificationStatus,
} from "@/lib/constants";
import { teacherVerificationEnabled } from "@/lib/features";
import { assertPlatformAdmin } from "../authz";
import { recordAudit } from "./audit";
import { notifyAdmins, notifyUser } from "./notifications";
import { inspectPrivateFile, privateStorageKey, type InspectedFile } from "./private-files";

/* ------------------------------------------------------------------------ */
/* Policy                                                                   */
/* ------------------------------------------------------------------------ */

/** Days a document is kept after the decision before it is securely deleted. */
export function documentRetentionDays() {
  const days = Number(process.env.TEACHER_DOC_RETENTION_DAYS ?? 30);
  return Number.isFinite(days) && days >= 0 ? Math.min(days, 365) : 30;
}

/** Wait after a rejection before applying again. */
export function reapplyCooldownDays() {
  const days = Number(process.env.TEACHER_REAPPLY_COOLDOWN_DAYS ?? 7);
  return Number.isFinite(days) && days >= 0 ? days : 7;
}

/** Legal transitions. Anything else is refused, whoever asks. */
const TRANSITIONS: Record<TeacherVerificationStatus, TeacherVerificationStatus[]> = {
  PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED", "NEEDS_MORE_INFORMATION", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "NEEDS_MORE_INFORMATION", "CANCELLED"],
  NEEDS_MORE_INFORMATION: ["PENDING", "UNDER_REVIEW", "REJECTED", "CANCELLED"],
  APPROVED: ["REVOKED"],
  REJECTED: [],
  CANCELLED: [],
  REVOKED: [],
};

export function canTransition(from: string, to: TeacherVerificationStatus) {
  return (TRANSITIONS[from as TeacherVerificationStatus] ?? []).includes(to);
}

const isOpen = (status: TeacherVerificationStatus) => OPEN_TEACHER_STATUSES.includes(status);

export type TeacherApplication = {
  fullName: string;
  collegeId?: string | null;
  institutionName: string;
  university?: string | null;
  department: string;
  designation: string;
  subjectsTaught: string;
  institutionalEmail?: string | null;
  employeeId?: string | null;
  verificationNotes?: string | null;
};

type FileInput = { name: string; bytes: Buffer };

function caseRef(id: string) {
  return `TV-${id.slice(-8).toUpperCase()}`;
}

/* ------------------------------------------------------------------------ */
/* Internals                                                                */
/* ------------------------------------------------------------------------ */

async function inspectAll(files: FileInput[]) {
  const inspected: InspectedFile[] = [];
  for (const file of files) {
    inspected.push(
      await inspectPrivateFile(file, {
        maxBytes: TEACHER_DOC_MAX_BYTES,
        allowed: TEACHER_DOC_MIME,
        label: file.name || "Document",
      }),
    );
  }
  return inspected;
}

/**
 * Writes already-inspected files to private storage and records them. If any
 * write fails, every object written in this call is removed again.
 */
async function storeDocuments(requestId: string, uploadedById: string, files: InspectedFile[]) {
  const written: string[] = [];
  try {
    for (const file of files) {
      const key = privateStorageKey("teacher-verification", requestId, file.extension);
      await storage().put({ key, body: file.bytes, contentType: file.mime });
      written.push(key);
      await prisma.teacherVerificationDocument.create({
        data: {
          verificationRequestId: requestId,
          uploadedById,
          storageKey: key,
          originalFilename: file.originalName,
          detectedMimeType: file.mime,
          fileSize: file.bytes.byteLength,
          checksum: file.sha256,
          scanStatus: "CLEAN",
          scanEngine: file.scanEngine,
        },
      });
    }
  } catch (err) {
    for (const key of written) await storage().delete(key).catch(() => undefined);
    await prisma.teacherVerificationDocument
      .deleteMany({ where: { storageKey: { in: written } } })
      .catch(() => undefined);
    throw err instanceof AppError
      ? err
      : new AppError("STORAGE_ERROR", "We couldn't store your document. Nothing was submitted; please try again.");
  }
}

/**
 * Atomic status change: the row only moves if it is still in a state that
 * allows the move, so two admins clicking at once cannot both win.
 */
async function transition(input: {
  requestId: string;
  to: TeacherVerificationStatus;
  actorId: string | null;
  data?: Record<string, unknown>;
  note?: string | null;
  internal?: boolean;
}) {
  const current = await prisma.teacherVerificationRequest.findUnique({ where: { id: input.requestId } });
  if (!current) throw notFound("Verification request");
  if (!canTransition(current.status, input.to)) {
    throw conflict(`This request is ${current.status.replace(/_/g, " ").toLowerCase()} and can't be moved to ${input.to.replace(/_/g, " ").toLowerCase()}.`);
  }
  const updated = await prisma.teacherVerificationRequest.updateMany({
    where: { id: current.id, status: current.status },
    data: {
      ...input.data,
      status: input.to,
      activeKey: isOpen(input.to) ? current.userId : null,
    },
  });
  if (updated.count === 0) throw conflict("Someone else just updated this request. Refresh and try again.");
  await prisma.teacherVerificationEvent.create({
    data: {
      requestId: current.id,
      actorId: input.actorId,
      type: "status_changed",
      fromStatus: current.status,
      toStatus: input.to,
      note: input.note ?? null,
      internal: input.internal ?? false,
    },
  });
  return current;
}

/** After a decision the documents are kept only for the retention window. */
async function scheduleDocumentDeletion(requestId: string) {
  const deleteAfter = new Date(Date.now() + documentRetentionDays() * 86_400_000);
  await prisma.teacherVerificationDocument.updateMany({
    where: { verificationRequestId: requestId, retentionStatus: "RETAINED" },
    data: { retentionStatus: "SCHEDULED_FOR_DELETION", deleteAfter },
  });
}

/* ------------------------------------------------------------------------ */
/* Applicant                                                                */
/* ------------------------------------------------------------------------ */

/** The applicant's own view: no internal notes, no storage keys, no reviewer identity. */
export async function myTeacherVerification(userId: string) {
  const requests = await prisma.teacherVerificationRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      fullName: true,
      institutionName: true,
      department: true,
      designation: true,
      subjectsTaught: true,
      infoRequested: true,
      rejectionReason: true,
      revokeReason: true,
      createdAt: true,
      updatedAt: true,
      reviewedAt: true,
      documents: {
        where: { retentionStatus: { not: "DELETED" } },
        select: { id: true, originalFilename: true, fileSize: true, uploadedAt: true },
        orderBy: { uploadedAt: "asc" },
      },
      events: {
        where: { internal: false },
        select: { id: true, type: true, toStatus: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return { current: requests[0] ?? null, history: requests.slice(1) };
}

export async function submitTeacherVerification(
  user: SessionUser,
  input: TeacherApplication,
  files: FileInput[],
  ip: string | null,
) {
  if (!teacherVerificationEnabled()) throw forbidden("Teacher verification isn't open right now. Please check back later.");
  assertVerifiedEmail(user);
  if (user.role === "TEACHER") throw conflict("Your teacher verification is already approved.");
  if (user.role !== "STUDENT") {
    throw forbidden("Staff accounts don't need teacher verification.");
  }
  // Same buckets whatever the entry point, so the limit cannot be sidestepped.
  await rateLimitAsync(`teacher-verify:user:${user.id}`, 3, 60 * 60_000);
  await rateLimitAsync(`teacher-verify:user-day:${user.id}`, 5, 24 * 60 * 60_000);
  if (ip) await rateLimitAsync(`teacher-verify:ip:${ip}`, 10, 60 * 60_000);

  if (files.length === 0) throw validation("Attach at least one document that shows your teaching affiliation.");
  if (files.length > TEACHER_DOC_MAX_FILES) throw validation(`Attach at most ${TEACHER_DOC_MAX_FILES} documents.`);

  const open = await prisma.teacherVerificationRequest.findUnique({ where: { activeKey: user.id } });
  if (open) throw conflict("You already have a verification request in progress.");

  const lastRejected = await prisma.teacherVerificationRequest.findFirst({
    where: { userId: user.id, status: "REJECTED" },
    orderBy: { reviewedAt: "desc" },
    select: { reviewedAt: true },
  });
  const cooldown = reapplyCooldownDays();
  if (lastRejected?.reviewedAt && cooldown > 0) {
    const allowedFrom = new Date(lastRejected.reviewedAt.getTime() + cooldown * 86_400_000);
    if (allowedFrom > new Date()) {
      throw conflict(
        `You can apply again from ${allowedFrom.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`,
      );
    }
  }

  if (input.collegeId) {
    const college = await prisma.college.findUnique({ where: { id: input.collegeId }, select: { id: true } });
    if (!college) throw validation("Choose a college from the list, or type your institution's name.");
  }

  // Validate and scan every file before anything is created.
  const inspected = await inspectAll(files);

  let request;
  try {
    request = await prisma.teacherVerificationRequest.create({
      data: {
        userId: user.id,
        activeKey: user.id,
        status: "PENDING",
        fullName: input.fullName,
        collegeId: input.collegeId || null,
        institutionName: input.institutionName,
        university: input.university || null,
        department: input.department,
        designation: input.designation,
        subjectsTaught: input.subjectsTaught,
        institutionalEmail: input.institutionalEmail || null,
        employeeId: input.employeeId || null,
        verificationNotes: input.verificationNotes || null,
        events: { create: { actorId: user.id, type: "submitted", toStatus: "PENDING" } },
      },
    });
  } catch (err) {
    // The activeKey unique index is the real guard against parallel submits.
    if ((err as { code?: string }).code === "P2002") {
      throw conflict("You already have a verification request in progress.");
    }
    throw err;
  }

  try {
    await storeDocuments(request.id, user.id, inspected);
  } catch (err) {
    await prisma.teacherVerificationRequest.delete({ where: { id: request.id } }).catch(() => undefined);
    throw err;
  }

  await recordAudit({
    actorId: user.id,
    action: "teacher_verification.submitted",
    entityType: "TeacherVerificationRequest",
    entityId: request.id,
    after: { documents: inspected.length },
  });
  await notifyUser({
    userId: user.id,
    type: "teacher_verification.submitted",
    title: "Verification submitted",
    body: "We've received your teacher verification request. An admin will review it; you'll be notified here when there's an update.",
    href: "/teacher-verification",
  });
  await notifyAdmins({
    type: "teacher_verification.submitted",
    caseId: caseRef(request.id),
    title: "New teacher verification request",
    summary: `${input.designation}, ${input.department} — ${input.institutionName}`,
    href: `/admin/teacher-verifications/${request.id}`,
    member: user.name,
  });
  return request;
}

/** Applicant answers an information request: notes and/or more documents. */
export async function provideMoreInformation(
  user: SessionUser,
  input: { requestId: string; notes: string },
  files: FileInput[],
) {
  await rateLimitAsync(`teacher-verify:user:${user.id}`, 3, 60 * 60_000);
  const request = await prisma.teacherVerificationRequest.findUnique({
    where: { id: input.requestId },
    include: { _count: { select: { documents: true } } },
  });
  // Someone else's request is reported as missing, not forbidden.
  if (!request || request.userId !== user.id) throw notFound("Verification request");
  if (request.status !== "NEEDS_MORE_INFORMATION") {
    throw conflict("This request isn't waiting for more information.");
  }
  if (!input.notes.trim() && files.length === 0) {
    throw validation("Add a note or attach a document so the reviewer has something new to look at.");
  }
  if (request._count.documents + files.length > TEACHER_DOC_MAX_FILES * 2) {
    throw validation("That's too many documents for one request.");
  }
  const inspected = await inspectAll(files);
  await storeDocuments(request.id, user.id, inspected);

  const stamp = new Date().toISOString().slice(0, 10);
  await transition({
    requestId: request.id,
    to: "PENDING",
    actorId: user.id,
    note: input.notes.trim() || null,
    data: {
      verificationNotes: [request.verificationNotes, input.notes.trim() ? `[${stamp}] ${input.notes.trim()}` : null]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000),
    },
  });
  await prisma.teacherVerificationEvent.create({
    data: { requestId: request.id, actorId: user.id, type: "info_provided", note: `${inspected.length} document(s) added` },
  });
  await recordAudit({
    actorId: user.id,
    action: "teacher_verification.info_provided",
    entityType: "TeacherVerificationRequest",
    entityId: request.id,
    after: { documents: inspected.length },
  });
  await notifyAdmins({
    type: "teacher_verification.info_provided",
    caseId: caseRef(request.id),
    title: "Applicant sent more information",
    summary: "A teacher verification request is back in the queue.",
    href: `/admin/teacher-verifications/${request.id}`,
    member: user.name,
  });
}

export async function cancelTeacherVerification(user: SessionUser, requestId: string) {
  const request = await prisma.teacherVerificationRequest.findUnique({ where: { id: requestId } });
  if (!request || request.userId !== user.id) throw notFound("Verification request");
  await transition({ requestId, to: "CANCELLED", actorId: user.id, note: "Withdrawn by the applicant." });
  await scheduleDocumentDeletion(requestId);
  await recordAudit({
    actorId: user.id,
    action: "teacher_verification.cancelled",
    entityType: "TeacherVerificationRequest",
    entityId: requestId,
  });
}

/* ------------------------------------------------------------------------ */
/* Platform admin                                                           */
/* ------------------------------------------------------------------------ */

export async function listTeacherVerifications(
  actor: SessionUser,
  input: { status?: string; page?: number },
) {
  assertPlatformAdmin(actor);
  const pageSize = 25;
  const page = Math.max(1, input.page ?? 1);
  const status = input.status && input.status !== "ALL" ? input.status : undefined;
  const where = status
    ? { status }
    : { status: { in: OPEN_TEACHER_STATUSES as string[] } };
  const [rows, total, counts] = await Promise.all([
    prisma.teacherVerificationRequest.findMany({
      where: input.status === "ALL" ? {} : where,
      orderBy: [{ createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        fullName: true,
        institutionName: true,
        department: true,
        designation: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.teacherVerificationRequest.count({ where: input.status === "ALL" ? {} : where }),
    prisma.teacherVerificationRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    rows,
    total,
    page,
    pageSize,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
  };
}

export async function teacherVerificationDetail(actor: SessionUser, id: string) {
  assertPlatformAdmin(actor);
  const request = await prisma.teacherVerificationRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, emailVerifiedAt: true },
      },
      college: { select: { id: true, name: true, shortName: true } },
      reviewer: { select: { name: true } },
      documents: {
        orderBy: { uploadedAt: "asc" },
        // storageKey deliberately omitted: the browser only ever sees an id.
        select: {
          id: true,
          originalFilename: true,
          detectedMimeType: true,
          fileSize: true,
          checksum: true,
          scanStatus: true,
          uploadedAt: true,
          reviewedAt: true,
          retentionStatus: true,
          deleteAfter: true,
          deletedAt: true,
        },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) return null;
  const [previous, actors] = await Promise.all([
    prisma.teacherVerificationRequest.findMany({
      where: { userId: request.userId, NOT: { id: request.id } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, rejectionReason: true, revokeReason: true },
    }),
    prisma.user.findMany({
      where: { id: { in: request.events.map((e) => e.actorId).filter((v): v is string => Boolean(v)) } },
      select: { id: true, name: true },
    }),
  ]);
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return {
    ...request,
    events: request.events.map((e) => ({ ...e, actorName: e.actorId ? names.get(e.actorId) ?? "Member" : "System" })),
    previous,
  };
}

function assertNotSelf(actor: SessionUser, userId: string) {
  if (actor.id === userId) throw forbidden("You can't review your own verification request.");
}

export async function startReview(actor: SessionUser, requestId: string) {
  assertPlatformAdmin(actor);
  const existing = await prisma.teacherVerificationRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw notFound("Verification request");
  assertNotSelf(actor, existing.userId);
  const current = await transition({ requestId, to: "UNDER_REVIEW", actorId: actor.id });
  await recordAudit({
    actorId: actor.id,
    action: "teacher_verification.under_review",
    entityType: "TeacherVerificationRequest",
    entityId: requestId,
  });
  await notifyUser({
    userId: current.userId,
    type: "teacher_verification.under_review",
    title: "Your application is under review",
    body: "An admin has started reviewing your teacher verification request.",
    href: "/teacher-verification",
    email: false,
  });
}

/**
 * Approval: the request moves to APPROVED and the member becomes TEACHER in
 * one transaction. The typed confirmation is required server-side, not just
 * in the dialog.
 */
export async function approveTeacherVerification(
  actor: SessionUser,
  input: { requestId: string; note?: string | null; confirm: string },
) {
  assertPlatformAdmin(actor);
  if (input.confirm !== "APPROVE") {
    throw validation("Type APPROVE to confirm granting the teacher role.");
  }
  const request = await prisma.teacherVerificationRequest.findUnique({
    where: { id: input.requestId },
    include: { user: { select: { id: true, role: true, status: true, anonymizedAt: true } } },
  });
  if (!request) throw notFound("Verification request");
  assertNotSelf(actor, request.userId);
  if (!canTransition(request.status, "APPROVED")) {
    throw conflict(`This request is ${request.status.replace(/_/g, " ").toLowerCase()} and can't be approved.`);
  }
  if (request.user.anonymizedAt) throw conflict("This account has been erased.");
  if (request.user.role !== "STUDENT") {
    throw conflict("Only student accounts can be granted the teacher role.");
  }
  if (request.user.status === "BANNED" || request.user.status === "SUSPENDED") {
    throw conflict("This account is suspended or banned. Resolve that first.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const moved = await tx.teacherVerificationRequest.updateMany({
      where: { id: request.id, status: request.status },
      data: {
        status: "APPROVED",
        activeKey: null,
        reviewedById: actor.id,
        reviewedAt: now,
        adminNotes: input.note
          ? [request.adminNotes, `[approval] ${input.note}`].filter(Boolean).join("\n\n").slice(0, 4000)
          : request.adminNotes,
      },
    });
    if (moved.count === 0) throw conflict("Someone else just updated this request. Refresh and try again.");
    // Conditional on the role still being STUDENT, so a concurrent role change can't be overwritten.
    const promoted = await tx.user.updateMany({
      where: { id: request.userId, role: "STUDENT" },
      data: { role: "TEACHER", teacherVerifiedAt: now },
    });
    if (promoted.count === 0) throw conflict("The member's role changed in the meantime. Refresh and try again.");
    await tx.teacherVerificationEvent.create({
      data: {
        requestId: request.id,
        actorId: actor.id,
        type: "status_changed",
        fromStatus: request.status,
        toStatus: "APPROVED",
        note: input.note ?? null,
        internal: true,
      },
    });
  });
  await scheduleDocumentDeletion(request.id);
  await recordAudit({
    actorId: actor.id,
    action: "teacher_verification.approved",
    entityType: "TeacherVerificationRequest",
    entityId: request.id,
    before: { status: request.status, role: "STUDENT" },
    after: { status: "APPROVED", role: "TEACHER", userId: request.userId },
    reason: input.note ?? null,
  });
  await recordAudit({
    actorId: actor.id,
    action: "user.role_changed",
    entityType: "User",
    entityId: request.userId,
    before: { role: "STUDENT" },
    after: { role: "TEACHER" },
    reason: `Teacher verification ${caseRef(request.id)} approved`,
  });
  await notifyUser({
    userId: request.userId,
    type: "teacher_verification.approved",
    title: "Your teacher verification has been approved",
    body: "Your profile now shows the Verified Teacher badge. It confirms your teaching affiliation only.",
    href: "/teacher-verification",
  });
}

export async function rejectTeacherVerification(
  actor: SessionUser,
  input: { requestId: string; reason: string; internalNote?: string | null },
) {
  assertPlatformAdmin(actor);
  if (!input.reason.trim()) throw validation("Give the applicant a reason.");
  const request = await prisma.teacherVerificationRequest.findUnique({ where: { id: input.requestId } });
  if (!request) throw notFound("Verification request");
  assertNotSelf(actor, request.userId);
  await transition({
    requestId: request.id,
    to: "REJECTED",
    actorId: actor.id,
    note: input.reason,
    data: {
      reviewedById: actor.id,
      reviewedAt: new Date(),
      rejectionReason: input.reason.trim(),
      adminNotes: input.internalNote
        ? [request.adminNotes, `[rejection] ${input.internalNote}`].filter(Boolean).join("\n\n").slice(0, 4000)
        : request.adminNotes,
    },
  });
  await scheduleDocumentDeletion(request.id);
  await recordAudit({
    actorId: actor.id,
    action: "teacher_verification.rejected",
    entityType: "TeacherVerificationRequest",
    entityId: request.id,
    before: { status: request.status },
    after: { status: "REJECTED" },
    reason: input.reason,
  });
  await notifyUser({
    userId: request.userId,
    type: "teacher_verification.rejected",
    title: "Your verification request was rejected",
    body: `Reason: ${input.reason.trim()}`,
    href: "/teacher-verification",
  });
}

export async function requestMoreInformation(
  actor: SessionUser,
  input: { requestId: string; message: string },
) {
  assertPlatformAdmin(actor);
  if (!input.message.trim()) throw validation("Say what the applicant needs to send.");
  const request = await prisma.teacherVerificationRequest.findUnique({ where: { id: input.requestId } });
  if (!request) throw notFound("Verification request");
  assertNotSelf(actor, request.userId);
  await transition({
    requestId: request.id,
    to: "NEEDS_MORE_INFORMATION",
    actorId: actor.id,
    note: input.message,
    data: { infoRequested: input.message.trim(), reviewedById: actor.id, reviewedAt: new Date() },
  });
  await recordAudit({
    actorId: actor.id,
    action: "teacher_verification.info_requested",
    entityType: "TeacherVerificationRequest",
    entityId: request.id,
    reason: input.message,
  });
  await notifyUser({
    userId: request.userId,
    type: "teacher_verification.needs_information",
    title: "Additional information is required",
    body: "The reviewer needs a little more before deciding. Open your verification page to see what's needed.",
    href: "/teacher-verification",
  });
}

export async function addTeacherVerificationNote(actor: SessionUser, input: { requestId: string; note: string }) {
  assertPlatformAdmin(actor);
  const note = input.note.trim();
  if (!note) throw validation("Write a note first.");
  const request = await prisma.teacherVerificationRequest.findUnique({ where: { id: input.requestId } });
  if (!request) throw notFound("Verification request");
  await prisma.$transaction([
    prisma.teacherVerificationRequest.update({
      where: { id: request.id },
      data: {
        adminNotes: [request.adminNotes, `[${new Date().toISOString().slice(0, 10)} ${actor.name}] ${note}`]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 8000),
      },
    }),
    prisma.teacherVerificationEvent.create({
      data: { requestId: request.id, actorId: actor.id, type: "note", note: note.slice(0, 2000), internal: true },
    }),
  ]);
  await recordAudit({
    actorId: actor.id,
    action: "teacher_verification.note_added",
    entityType: "TeacherVerificationRequest",
    entityId: request.id,
  });
}

/** Revocation removes the role, keeps the history, and tells the member. */
export async function revokeTeacherVerification(
  actor: SessionUser,
  input: { requestId: string; reason: string },
) {
  assertPlatformAdmin(actor);
  if (!input.reason.trim()) throw validation("Give a reason for revoking.");
  const request = await prisma.teacherVerificationRequest.findUnique({ where: { id: input.requestId } });
  if (!request) throw notFound("Verification request");
  if (request.status !== "APPROVED") throw conflict("Only an approved verification can be revoked.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const moved = await tx.teacherVerificationRequest.updateMany({
      where: { id: request.id, status: "APPROVED" },
      data: { status: "REVOKED", revokedAt: now, revokeReason: input.reason.trim() },
    });
    if (moved.count === 0) throw conflict("Someone else just updated this request. Refresh and try again.");
    // Only demote if they are still a teacher (a platform admin may have changed it since).
    await tx.user.updateMany({
      where: { id: request.userId, role: "TEACHER" },
      data: { role: "STUDENT", teacherVerifiedAt: null },
    });
    await tx.user.updateMany({ where: { id: request.userId }, data: { teacherVerifiedAt: null } });
    await tx.teacherVerificationEvent.create({
      data: {
        requestId: request.id,
        actorId: actor.id,
        type: "status_changed",
        fromStatus: "APPROVED",
        toStatus: "REVOKED",
        note: input.reason.trim(),
      },
    });
  });
  await scheduleDocumentDeletion(request.id);
  await recordAudit({
    actorId: actor.id,
    action: "teacher_verification.revoked",
    entityType: "TeacherVerificationRequest",
    entityId: request.id,
    before: { status: "APPROVED", role: "TEACHER" },
    after: { status: "REVOKED", role: "STUDENT", userId: request.userId },
    reason: input.reason,
  });
  await recordAudit({
    actorId: actor.id,
    action: "user.role_changed",
    entityType: "User",
    entityId: request.userId,
    before: { role: "TEACHER" },
    after: { role: "STUDENT" },
    reason: `Teacher verification ${caseRef(request.id)} revoked`,
  });
  await notifyUser({
    userId: request.userId,
    type: "teacher_verification.revoked",
    title: "Your teacher verification was revoked",
    body: `Reason: ${input.reason.trim()}`,
    href: "/teacher-verification",
  });
}

/**
 * Authorized document read. Checked on every access (platform admin with a
 * second factor), audited every time, and never served for a deleted file.
 */
export async function openTeacherDocument(actor: SessionUser, documentId: string) {
  assertPlatformAdmin(actor);
  const doc = await prisma.teacherVerificationDocument.findUnique({
    where: { id: documentId },
    include: { request: { select: { id: true, userId: true } } },
  });
  if (!doc || doc.retentionStatus === "DELETED" || doc.deletedAt) throw notFound("Document");
  await prisma.teacherVerificationDocument.update({
    where: { id: doc.id },
    data: { reviewedAt: doc.reviewedAt ?? new Date() },
  });
  await recordAudit({
    actorId: actor.id,
    action: "teacher_verification.document_accessed",
    entityType: "TeacherVerificationDocument",
    entityId: doc.id,
    after: { requestId: doc.request.id },
  });
  const signed = await storage().signedUrl(doc.storageKey, 60);
  if (signed) return { kind: "redirect" as const, url: signed };
  const bytes = await storage().get(doc.storageKey);
  return {
    kind: "bytes" as const,
    bytes,
    mime: doc.detectedMimeType,
    filename: doc.originalFilename,
  };
}

async function destroyDocument(doc: { id: string; storageKey: string; verificationRequestId: string }, actorId: string | null, why: string) {
  await storage().delete(doc.storageKey);
  await prisma.teacherVerificationDocument.update({
    where: { id: doc.id },
    data: { retentionStatus: "DELETED", deletedAt: new Date() },
  });
  await prisma.teacherVerificationEvent.create({
    data: { requestId: doc.verificationRequestId, actorId, type: "document_deleted", note: why },
  });
  await recordAudit({
    actorId,
    action: "teacher_verification.document_deleted",
    entityType: "TeacherVerificationDocument",
    entityId: doc.id,
    after: { requestId: doc.verificationRequestId },
    reason: why,
  });
}

/** Admin-initiated deletion once a decision has been made. */
export async function deleteTeacherDocumentsNow(actor: SessionUser, requestId: string) {
  assertPlatformAdmin(actor);
  const request = await prisma.teacherVerificationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw notFound("Verification request");
  if (isOpen(request.status as TeacherVerificationStatus)) {
    throw conflict("Decide the request before deleting its documents.");
  }
  const docs = await prisma.teacherVerificationDocument.findMany({
    where: { verificationRequestId: requestId, retentionStatus: { not: "DELETED" } },
  });
  for (const doc of docs) await destroyDocument(doc, actor.id, "Deleted by an admin after the decision.");
  return docs.length;
}

/** Nightly: securely delete documents whose retention window has passed. */
export async function purgeExpiredTeacherDocuments(limit = 200) {
  const due = await prisma.teacherVerificationDocument.findMany({
    where: { retentionStatus: "SCHEDULED_FOR_DELETION", deleteAfter: { lte: new Date() } },
    take: limit,
  });
  let deleted = 0;
  for (const doc of due) {
    try {
      await destroyDocument(doc, null, "Retention period ended.");
      deleted += 1;
    } catch (err) {
      logger.error("teacher_doc_purge_failed", { documentId: doc.id, error: String(err) });
    }
  }
  return deleted;
}

/** Public: is this member a verified teacher? Only the fact, nothing else. */
export function isVerifiedTeacher(user: { role: string; teacherVerifiedAt?: Date | null }) {
  return user.role === "TEACHER";
}
