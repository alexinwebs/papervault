import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaRaw } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth";
import {
  adminReply,
  adminTicketDetail,
  closeTicketAsRequester,
  createTicket,
  nextTicketNumber,
  openTicketAttachment,
  replyAsRequester,
  ticketForRequester,
  updateTicket,
} from "@/server/services/tickets";
import { decideCollegeRequest, decideSubjectRequest } from "@/server/services/catalogue-requests";
import { reportUser, resolveUserReport } from "@/server/services/user-reports";
import { setUserStanding } from "@/server/services/standing";
import { recordAudit } from "@/server/services/audit";
import { makeUser, tag as newTag, tinyPng } from "./helpers";

const t = newTag();
const users: SessionUser[] = [];
const collegeIds: string[] = [];
const subjectIds: string[] = [];
let admin: SessionUser;
let ravi: SessionUser;
let meera: SessionUser;
let mod: SessionUser;

const ticket = (subject: string, extra: Record<string, unknown> = {}) => ({
  category: "GENERAL" as const,
  subject,
  body: `Body for ${subject} — enough words to be a real message.`,
  ...extra,
});

beforeAll(async () => {
  admin = await makeUser("wf-admin", t, { role: "PLATFORM_ADMIN" });
  ravi = await makeUser("wf-ravi", t);
  meera = await makeUser("wf-meera", t);
  mod = await makeUser("wf-mod", t, { role: "MODERATOR" });
  users.push(admin, ravi, meera, mod);
});

afterAll(async () => {
  const ids = users.map((u) => u.id);
  const atts = await prismaRaw.ticketAttachment.findMany({ where: { ticket: { requesterId: { in: ids } } } });
  for (const a of atts) await storage().delete(a.storageKey).catch(() => undefined);
  await prismaRaw.supportTicket.deleteMany({ where: { requesterId: { in: ids } } });
  await prismaRaw.userReport.deleteMany({ where: { OR: [{ reportedById: { in: ids } }, { reportedUserId: { in: ids } }] } });
  if (subjectIds.length) await prismaRaw.subject.deleteMany({ where: { id: { in: subjectIds } } });
  if (collegeIds.length) await prismaRaw.college.deleteMany({ where: { id: { in: collegeIds } } });
  await prismaRaw.user.deleteMany({ where: { id: { in: ids } } });
  await prismaRaw.$disconnect();
});

describe("support tickets", () => {
  it("numbers tickets PV-YYYY-NNNNNN with no duplicates under concurrency", async () => {
    const numbers = await Promise.all(Array.from({ length: 25 }, () => nextTicketNumber()));
    for (const n of numbers) expect(n).toMatch(new RegExp(`^PV-${new Date().getUTCFullYear()}-\\d{6}$`));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("keeps a requester's ticket private from other members (no IDOR)", async () => {
    const created = await createTicket(ravi, ticket(`Private ${t}`), [], null);
    await expect(ticketForRequester(ravi, created.id)).resolves.toMatchObject({ id: created.id });
    await expect(ticketForRequester(meera, created.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(replyAsRequester(meera, { ticketId: created.id, body: "sneaky" }, [])).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(adminTicketDetail(mod, created.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(adminTicketDetail(ravi, created.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("hides internal notes and their attachments from the requester", async () => {
    const created = await createTicket(ravi, ticket(`Notes ${t}`), [{ name: "proof.png", bytes: tinyPng(1) }], null);
    await adminReply(admin, { ticketId: created.id, body: `internal-${t}`, internal: true });
    await adminReply(admin, { ticketId: created.id, body: `public-${t}`, internal: false });
    const view = await ticketForRequester(ravi, created.id);
    const bodies = JSON.stringify(view);
    expect(bodies).toContain(`public-${t}`);
    expect(bodies).not.toContain(`internal-${t}`);
    const fresh = await prismaRaw.supportTicket.findUniqueOrThrow({ where: { id: created.id } });
    expect(fresh.status).toBe("WAITING_FOR_USER");

    const att = await prismaRaw.ticketAttachment.findFirstOrThrow({ where: { ticketId: created.id } });
    expect(att.storageKey.startsWith("private/")).toBe(true);
    await expect(openTicketAttachment(ravi, att.id)).resolves.toBeTruthy();
    await expect(openTicketAttachment(meera, att.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(openTicketAttachment(admin, att.id)).resolves.toBeTruthy();
    const accessed = await prismaRaw.auditLog.count({ where: { action: "ticket.attachment_accessed", entityId: att.id } });
    expect(accessed).toBe(1);
  });

  it("treats a repeated reply token as one message and refuses replies once closed", async () => {
    const created = await createTicket(ravi, ticket(`Idem ${t}`), [], null);
    const token = `tok-${t}`;
    await replyAsRequester(ravi, { ticketId: created.id, body: "once", clientToken: token }, []);
    await replyAsRequester(ravi, { ticketId: created.id, body: "once", clientToken: token }, []).catch(() => undefined);
    expect(await prismaRaw.ticketMessage.count({ where: { ticketId: created.id, clientToken: token } })).toBe(1);
    await closeTicketAsRequester(ravi, created.id);
    await expect(replyAsRequester(ravi, { ticketId: created.id, body: "again" }, [])).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only lets platform admins change status, and records events", async () => {
    const created = await createTicket(meera, ticket(`Status ${t}`), [], null);
    await expect(updateTicket(mod, { ticketId: created.id, status: "IN_REVIEW" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateTicket(admin, { ticketId: created.id, status: "RESOLVED", priority: "HIGH" });
    const fresh = await prismaRaw.supportTicket.findUniqueOrThrow({ where: { id: created.id }, include: { events: true } });
    expect(fresh.status).toBe("RESOLVED");
    expect(fresh.resolvedAt).not.toBeNull();
    expect(fresh.events.some((e) => e.type === "status" && e.toValue === "RESOLVED")).toBe(true);
  });

  it("lets restricted members contact support but requires a verified email", async () => {
    const restricted = await makeUser("wf-restricted", t, { status: "RESTRICTED" });
    const unverified = await makeUser("wf-unverified", t, { emailVerifiedAt: null });
    users.push(restricted, unverified);
    await expect(createTicket(restricted, ticket(`Appeal ${t}`, { category: "ACCOUNT" }), [], null)).resolves.toBeTruthy();
    await expect(createTicket(unverified, ticket(`Nope ${t}`), [], null)).rejects.toMatchObject({ code: "EMAIL_UNVERIFIED" });
  });
});

describe("college and subject requests", () => {
  it("refuses a college that's already listed", async () => {
    const existing = await prismaRaw.college.findFirstOrThrow({ select: { name: true } });
    await expect(
      createTicket(
        meera,
        ticket("Add college", { category: "ADD_COLLEGE", college: { name: existing.name, university: "U", city: "C", state: "S" } }),
        [],
        null,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("approving creates the college once, resolves the ticket, and a second approval conflicts", async () => {
    const name = `Wf Institute ${t}`;
    const created = await createTicket(
      ravi,
      ticket("Please add my college", { category: "ADD_COLLEGE", college: { name, university: "Wf University", city: "Pune", state: "Maharashtra" } }),
      [],
      null,
    );
    const req = await prismaRaw.collegeRequest.findUniqueOrThrow({ where: { ticketId: created.id } });
    await expect(decideCollegeRequest(admin, { requestId: req.id, decision: "REJECT" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const results = await Promise.allSettled([
      decideCollegeRequest(admin, { requestId: req.id, decision: "APPROVE", shortName: `WF${t}`.slice(0, 10) }),
      decideCollegeRequest(admin, { requestId: req.id, decision: "APPROVE", shortName: `WF${t}`.slice(0, 10) }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const college = (ok[0] as PromiseFulfilledResult<{ id: string }>).value;
    collegeIds.push(college.id);
    expect(await prismaRaw.college.count({ where: { name } })).toBe(1);
    const fresh = await prismaRaw.supportTicket.findUniqueOrThrow({ where: { id: created.id } });
    expect(fresh.status).toBe("RESOLVED");
    const freshReq = await prismaRaw.collegeRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(freshReq.status).toBe("APPROVED");
  });

  it("approves a subject into a semester of the requested college", async () => {
    const semester = await prismaRaw.semester.findFirstOrThrow({
      select: { id: true, branch: { select: { program: { select: { collegeId: true } } } } },
    });
    const collegeId = semester.branch.program.collegeId;
    const created = await createTicket(
      meera,
      ticket("Add subject", { category: "ADD_SUBJECT", subjectRequest: { collegeId, subjectName: `Wf Subject ${t}`, subjectCode: `WF${t.slice(0, 4)}` } }),
      [],
      null,
    );
    const req = await prismaRaw.subjectRequest.findUniqueOrThrow({ where: { ticketId: created.id } });
    const subject = await decideSubjectRequest(admin, { requestId: req.id, decision: "APPROVE", semesterId: semester.id });
    expect(subject).toBeTruthy();
    subjectIds.push(subject!.id);
    await expect(decideSubjectRequest(admin, { requestId: req.id, decision: "APPROVE", semesterId: semester.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("member reports and standing", () => {
  it("records a member report once and lets an admin resolve it", async () => {
    await expect(reportUser(ravi, { userId: ravi.id, reason: "SPAM" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const report = await reportUser(ravi, { userId: meera.id, reason: "SPAM", details: "spam links" });
    await expect(reportUser(ravi, { userId: meera.id, reason: "SPAM" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(resolveUserReport(mod, { reportId: report.id, status: "DISMISSED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await resolveUserReport(admin, { reportId: report.id, status: "RESOLVED", resolution: "warned" });
    await expect(resolveUserReport(admin, { reportId: report.id, status: "RESOLVED" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("suspending revokes sessions and is audited with its reason", async () => {
    const target = await makeUser("wf-target", t);
    users.push(target);
    await prismaRaw.session.create({
      data: { userId: target.id, expiresAt: new Date(Date.now() + 86_400_000) },
    } as never);
    await setUserStanding(admin, { userId: target.id, status: "SUSPENDED", reason: `spam ${t}`, days: 3 });
    const fresh = await prismaRaw.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(fresh.status).toBe("SUSPENDED");
    expect(fresh.statusUntil).not.toBeNull();
    expect(await prismaRaw.session.count({ where: { userId: target.id } })).toBe(0);
    const audit = await prismaRaw.auditLog.findFirst({ where: { entityId: target.id, reason: `spam ${t}` } });
    expect(audit).not.toBeNull();
    await expect(setUserStanding(admin, { userId: admin.id, status: "BANNED" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("audit log", () => {
  it("is append-only: updates and deletes are rejected by the database", async () => {
    await recordAudit({ actorId: admin.id, action: `test.immutable`, entityType: "Test", entityId: `wf-${t}` });
    const row = await prismaRaw.auditLog.findFirstOrThrow({ where: { entityId: `wf-${t}` } });
    await expect(prismaRaw.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } })).rejects.toThrow();
    await expect(prismaRaw.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
    // Clearing the actor (account removal) is the one permitted change.
    await expect(prismaRaw.auditLog.update({ where: { id: row.id }, data: { actorId: null } })).resolves.toBeTruthy();
  });
});
