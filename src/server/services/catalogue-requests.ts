import { prisma } from "@/lib/db";
import { conflict, notFound, validation } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import { assertPlatformAdmin } from "../authz";
import { recordAudit } from "./audit";
import { createCollege, createSubject } from "./admin";
import { notifyUser } from "./notifications";

/**
 * "Add a college" / "Add a subject" requests. They arrive as support tickets
 * (so the member can follow up in one thread) and are decided here. Approving
 * reuses the normal admin create functions, so a requested college or subject
 * is exactly the same as one an admin typed in.
 */

const OPEN = ["REQUESTED", "NEEDS_INFORMATION"];
export type RequestDecision = "APPROVE" | "REJECT" | "NEEDS_INFORMATION";

export async function openCatalogueRequests(actor: SessionUser) {
  assertPlatformAdmin(actor);
  const [colleges, subjects] = await Promise.all([
    prisma.collegeRequest.findMany({
      where: { status: { in: OPEN } },
      orderBy: { createdAt: "asc" },
      include: { ticket: { select: { id: true, number: true, requester: { select: { name: true } } } } },
    }),
    prisma.subjectRequest.findMany({
      where: { status: { in: OPEN } },
      orderBy: { createdAt: "asc" },
      include: {
        ticket: { select: { id: true, number: true, requester: { select: { name: true } } } },
        college: { select: { id: true, name: true, shortName: true } },
        semester: { select: { id: true, number: true, branch: { select: { name: true, program: { select: { name: true } } } } } },
      },
    }),
  ]);
  return { colleges, subjects };
}

/** Semesters of a college, for the "where should this subject go" picker. */
export function semesterOptions(collegeId: string) {
  return prisma.semester.findMany({
    where: { branch: { program: { collegeId } } },
    orderBy: [{ branch: { program: { name: "asc" } } }, { branch: { name: "asc" } }, { number: "asc" }],
    select: { id: true, number: true, branch: { select: { name: true, program: { select: { name: true } } } } },
  });
}

async function finishTicket(
  actor: SessionUser,
  ticket: { id: string; number: string; requesterId: string; status: string; subject: string },
  decision: RequestDecision,
  message: string,
) {
  const status = decision === "NEEDS_INFORMATION" ? "WAITING_FOR_USER" : "RESOLVED";
  const now = new Date();
  await prisma.ticketMessage.create({ data: { ticketId: ticket.id, authorId: actor.id, body: message } });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status, lastActivityAt: now, resolvedAt: status === "RESOLVED" ? now : null },
  });
  await prisma.ticketEvent.create({
    data: { ticketId: ticket.id, actorId: actor.id, type: "request_decision", fromValue: ticket.status, toValue: decision },
  });
  await notifyUser({
    userId: ticket.requesterId,
    type: "ticket.request_decision",
    title: `Update on ${ticket.number}`,
    body: message,
    href: `/my-tickets/${ticket.id}`,
  });
}

export async function decideCollegeRequest(
  actor: SessionUser,
  input: {
    requestId: string;
    decision: RequestDecision;
    note?: string | null;
    name?: string;
    shortName?: string;
    university?: string;
    city?: string;
    state?: string;
  },
) {
  assertPlatformAdmin(actor);
  const request = await prisma.collegeRequest.findUnique({ where: { id: input.requestId }, include: { ticket: true } });
  if (!request) throw notFound("College request");
  if (!OPEN.includes(request.status)) throw conflict("This request has already been decided.");
  const note = input.note?.trim() || null;
  if (input.decision !== "APPROVE" && !note) throw validation("Add a note for the member.");

  if (input.decision !== "APPROVE") {
    const claimed = await prisma.collegeRequest.updateMany({
      where: { id: request.id, status: { in: OPEN } },
      data: { status: input.decision === "REJECT" ? "REJECTED" : "NEEDS_INFORMATION", decisionNote: note, reviewedById: actor.id, reviewedAt: new Date() },
    });
    if (claimed.count === 0) throw conflict("This request has already been decided.");
    await recordAudit({
      actorId: actor.id,
      action: input.decision === "REJECT" ? "college_request.rejected" : "college_request.needs_information",
      entityType: "CollegeRequest",
      entityId: request.id,
      reason: note,
    });
    await finishTicket(
      actor,
      request.ticket,
      input.decision,
      input.decision === "REJECT"
        ? `We couldn't add ${request.name}: ${note}`
        : `We need a little more information about ${request.name}: ${note}`,
    );
    return null;
  }

  const name = (input.name || request.name).trim();
  const shortName = (input.shortName || "").trim();
  if (shortName.length < 2) throw validation("Give the college a short name (e.g. RKGIT).");
  // Claim first so two admins can't both create the college.
  const claimed = await prisma.collegeRequest.updateMany({
    where: { id: request.id, status: { in: OPEN } },
    data: { status: "APPROVED", decisionNote: note, reviewedById: actor.id, reviewedAt: new Date() },
  });
  if (claimed.count === 0) throw conflict("This request has already been decided.");
  let college;
  try {
    college = await createCollege(actor, {
      name,
      shortName,
      slug: "",
      city: (input.city || request.city).trim(),
      state: (input.state || request.state).trim(),
      university: (input.university || request.university).trim(),
      about: "",
      accent: "blue",
      verified: false,
      featured: false,
    });
  } catch (err) {
    await prisma.collegeRequest.update({
      where: { id: request.id },
      data: { status: request.status, reviewedById: null, reviewedAt: null, decisionNote: request.decisionNote },
    });
    throw err;
  }
  await prisma.collegeRequest.update({ where: { id: request.id }, data: { createdCollegeId: college.id } });
  await recordAudit({
    actorId: actor.id,
    action: "college_request.approved",
    entityType: "CollegeRequest",
    entityId: request.id,
    after: { collegeId: college.id, name: college.name },
    reason: note,
  });
  await finishTicket(
    actor,
    request.ticket,
    "APPROVE",
    `${college.name} has been added to PaperVault. Degrees and subjects will be filled in as papers arrive.${note ? ` ${note}` : ""}`,
  );
  return college;
}

export async function decideSubjectRequest(
  actor: SessionUser,
  input: {
    requestId: string;
    decision: RequestDecision;
    note?: string | null;
    semesterId?: string;
    name?: string;
    code?: string;
  },
) {
  assertPlatformAdmin(actor);
  const request = await prisma.subjectRequest.findUnique({ where: { id: input.requestId }, include: { ticket: true } });
  if (!request) throw notFound("Subject request");
  if (!OPEN.includes(request.status)) throw conflict("This request has already been decided.");
  const note = input.note?.trim() || null;
  if (input.decision !== "APPROVE" && !note) throw validation("Add a note for the member.");

  if (input.decision !== "APPROVE") {
    const claimed = await prisma.subjectRequest.updateMany({
      where: { id: request.id, status: { in: OPEN } },
      data: { status: input.decision === "REJECT" ? "REJECTED" : "NEEDS_INFORMATION", decisionNote: note, reviewedById: actor.id, reviewedAt: new Date() },
    });
    if (claimed.count === 0) throw conflict("This request has already been decided.");
    await recordAudit({
      actorId: actor.id,
      action: input.decision === "REJECT" ? "subject_request.rejected" : "subject_request.needs_information",
      entityType: "SubjectRequest",
      entityId: request.id,
      reason: note,
    });
    await finishTicket(
      actor,
      request.ticket,
      input.decision,
      input.decision === "REJECT"
        ? `We couldn't add ${request.subjectName}: ${note}`
        : `We need a little more information about ${request.subjectName}: ${note}`,
    );
    return null;
  }

  const semesterId = input.semesterId || request.semesterId;
  if (!semesterId) throw validation("Choose the semester the subject belongs to.");
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { branch: { select: { program: { select: { collegeId: true } } } } },
  });
  if (!semester || semester.branch.program.collegeId !== request.collegeId) {
    throw validation("That semester isn't part of the requested college.");
  }
  const code = (input.code || request.subjectCode || "").trim();
  if (code.length < 2) throw validation("Enter the subject code.");
  const duplicate = await prisma.subject.findFirst({
    where: { semesterId, OR: [{ code: code.toUpperCase() }, { name: { equals: (input.name || request.subjectName).trim(), mode: "insensitive" } }] },
    select: { name: true },
  });
  if (duplicate) throw conflict(`${duplicate.name} already exists in that semester.`);

  const claimed = await prisma.subjectRequest.updateMany({
    where: { id: request.id, status: { in: OPEN } },
    data: { status: "APPROVED", decisionNote: note, reviewedById: actor.id, reviewedAt: new Date(), semesterId },
  });
  if (claimed.count === 0) throw conflict("This request has already been decided.");
  let subject;
  try {
    subject = await createSubject(actor, { semesterId, name: (input.name || request.subjectName).trim(), code, slug: "", curriculumVersionId: "" });
  } catch (err) {
    await prisma.subjectRequest.update({
      where: { id: request.id },
      data: { status: request.status, reviewedById: null, reviewedAt: null, semesterId: request.semesterId },
    });
    throw err;
  }
  await prisma.subjectRequest.update({ where: { id: request.id }, data: { createdSubjectId: subject.id } });
  await recordAudit({
    actorId: actor.id,
    action: "subject_request.approved",
    entityType: "SubjectRequest",
    entityId: request.id,
    after: { subjectId: subject.id, name: subject.name, code: subject.code },
    reason: note,
  });
  await finishTicket(actor, request.ticket, "APPROVE", `${subject.name} (${subject.code}) has been added.${note ? ` ${note}` : ""}`);
  return subject;
}
