import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaRaw } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth";
import {
  approveTeacherVerification,
  listTeacherVerifications,
  myTeacherVerification,
  openTeacherDocument,
  purgeExpiredTeacherDocuments,
  rejectTeacherVerification,
  requestMoreInformation,
  provideMoreInformation,
  revokeTeacherVerification,
  startReview,
  submitTeacherVerification,
  addTeacherVerificationNote,
  teacherVerificationDetail,
} from "@/server/services/teacher-verification";
import { changeRole, updateMember } from "@/server/services/admin";
import { makeUser, tag as newTag, tinyPng } from "./helpers";

const t = newTag();
const users: SessionUser[] = [];
let admin: SessionUser;
let alice: SessionUser;
let bob: SessionUser;
let carol: SessionUser;
let mod: SessionUser;

const application = (name: string) => ({
  fullName: name,
  collegeId: "",
  institutionName: "Example Institute of Technology",
  university: "AKTU",
  department: "Computer Science",
  designation: "Assistant Professor",
  subjectsTaught: "DBMS, Operating Systems",
  institutionalEmail: "",
  employeeId: "",
  verificationNotes: "",
});
const doc = (n = 0) => [{ name: `staff-id-${n}.png`, bytes: tinyPng(n) }];

// These tests exercise the open workflow, so they force the switch on
// regardless of what the local .env says (production keeps it off).
const savedSwitch = process.env.TEACHER_VERIFICATION_ENABLED;

beforeAll(async () => {
  process.env.TEACHER_VERIFICATION_ENABLED = "true";
  admin = await makeUser("tv-admin", t, { role: "PLATFORM_ADMIN" });
  alice = await makeUser("tv-alice", t);
  bob = await makeUser("tv-bob", t);
  carol = await makeUser("tv-carol", t);
  mod = await makeUser("tv-mod", t, { role: "MODERATOR" });
  users.push(admin, alice, bob, carol, mod);
});

afterAll(async () => {
  if (savedSwitch === undefined) delete process.env.TEACHER_VERIFICATION_ENABLED;
  else process.env.TEACHER_VERIFICATION_ENABLED = savedSwitch;
  const docs = await prismaRaw.teacherVerificationDocument.findMany({
    where: { request: { userId: { in: users.map((u) => u.id) } } },
  });
  for (const d of docs) await storage().delete(d.storageKey).catch(() => undefined);
  await prismaRaw.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prismaRaw.$disconnect();
});

describe("teacher verification", () => {
  it("stores a request privately without changing the role", async () => {
    const req = await submitTeacherVerification(alice, application("Alice"), doc(1), "10.0.0.1");
    expect(req.status).toBe("PENDING");
    const row = await prismaRaw.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(row.role).toBe("STUDENT");
    const docs = await prismaRaw.teacherVerificationDocument.findMany({ where: { verificationRequestId: req.id } });
    expect(docs).toHaveLength(1);
    expect(docs[0].storageKey.startsWith("private/teacher-verification/")).toBe(true);
    expect(docs[0].detectedMimeType).toBe("image/png");
  });

  it("allows only one open request per user", async () => {
    await expect(submitTeacherVerification(alice, application("Alice"), doc(2), null)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("holds under concurrent submits (exactly one wins)", async () => {
    const results = await Promise.allSettled(
      [0, 1].map((i) => submitTeacherVerification(bob, application("Bob"), doc(10 + i), null)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prismaRaw.teacherVerificationRequest.count({ where: { userId: bob.id } })).toBe(1);
  });

  it("refuses staff and unverified accounts, and files that are not documents", async () => {
    await expect(submitTeacherVerification(mod, application("Mod"), doc(3), null)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const unverified = await makeUser("tv-unverified", t, { emailVerifiedAt: null });
    users.push(unverified);
    await expect(submitTeacherVerification(unverified, application("U"), doc(4), null)).rejects.toMatchObject({
      code: "EMAIL_UNVERIFIED",
    });
    await expect(
      submitTeacherVerification(carol, application("Carol"), [{ name: "x.png", bytes: Buffer.from("<script>alert(1)</script>") }], null),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await prismaRaw.teacherVerificationRequest.count({ where: { userId: carol.id } })).toBe(0);
  });

  it("keeps the admin queue and documents away from non-admins", async () => {
    const req = await prismaRaw.teacherVerificationRequest.findFirstOrThrow({ where: { userId: alice.id } });
    const docRow = await prismaRaw.teacherVerificationDocument.findFirstOrThrow({ where: { verificationRequestId: req.id } });
    for (const actor of [alice, bob, mod]) {
      await expect(listTeacherVerifications(actor, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(teacherVerificationDetail(actor, req.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(openTeacherDocument(actor, docRow.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        approveTeacherVerification(actor, { requestId: req.id, confirm: "APPROVE", note: null }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    // The admin detail never exposes the storage key.
    const detail = await teacherVerificationDetail(admin, req.id);
    expect(JSON.stringify(detail)).not.toContain("private/teacher-verification");
  });

  it("audits every document view by an admin", async () => {
    const req = await prismaRaw.teacherVerificationRequest.findFirstOrThrow({ where: { userId: alice.id } });
    const docRow = await prismaRaw.teacherVerificationDocument.findFirstOrThrow({ where: { verificationRequestId: req.id } });
    const opened = await openTeacherDocument(admin, docRow.id);
    expect(opened.kind).toBe("bytes");
    const audit = await prismaRaw.auditLog.count({
      where: { action: "teacher_verification.document_accessed", entityId: docRow.id, actorId: admin.id },
    });
    expect(audit).toBe(1);
  });

  it("hides internal notes from the applicant", async () => {
    const req = await prismaRaw.teacherVerificationRequest.findFirstOrThrow({ where: { userId: alice.id } });
    await addTeacherVerificationNote(admin, { requestId: req.id, note: "INTERNAL-ONLY-NOTE" });
    const mine = await myTeacherVerification(alice.id);
    expect(JSON.stringify(mine)).not.toContain("INTERNAL-ONLY-NOTE");
  });

  it("supports the more-information loop", async () => {
    const req = await prismaRaw.teacherVerificationRequest.findFirstOrThrow({ where: { userId: alice.id } });
    await startReview(admin, req.id);
    await requestMoreInformation(admin, { requestId: req.id, message: "Please add your appointment letter." });
    expect((await prismaRaw.teacherVerificationRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe(
      "NEEDS_MORE_INFORMATION",
    );
    await provideMoreInformation(alice, { requestId: req.id, notes: "Attached." }, doc(5));
    const after = await prismaRaw.teacherVerificationRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(after.status).not.toBe("NEEDS_MORE_INFORMATION");
  });

  it("approves only with the typed confirmation, then grants TEACHER", async () => {
    const req = await prismaRaw.teacherVerificationRequest.findFirstOrThrow({ where: { userId: alice.id } });
    await expect(
      approveTeacherVerification(admin, { requestId: req.id, confirm: "yes", note: null }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await approveTeacherVerification(admin, { requestId: req.id, confirm: "APPROVE", note: null });
    const user = await prismaRaw.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(user.role).toBe("TEACHER");
    expect(user.teacherVerifiedAt).not.toBeNull();
    const row = await prismaRaw.teacherVerificationRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(row.status).toBe("APPROVED");
    expect(row.activeKey).toBeNull();
    const docs = await prismaRaw.teacherVerificationDocument.findMany({ where: { verificationRequestId: req.id } });
    expect(docs.every((d) => d.retentionStatus === "SCHEDULED_FOR_DELETION" && d.deleteAfter)).toBe(true);
    // A second approval (replayed form) is rejected.
    await expect(
      approveTeacherVerification(admin, { requestId: req.id, confirm: "APPROVE", note: null }),
    ).rejects.toBeTruthy();
  });

  it("never lets TEACHER be granted through the member editor or role changes", async () => {
    await expect(changeRole(admin, { userId: bob.id, role: "TEACHER" })).rejects.toBeTruthy();
    await expect(
      updateMember(admin, {
        userId: bob.id,
        name: bob.name,
        email: bob.email,
        role: "TEACHER",
        collegeId: "",
        trustLevel: "NEW",
      }),
    ).rejects.toBeTruthy();
    expect((await prismaRaw.user.findUniqueOrThrow({ where: { id: bob.id } })).role).toBe("STUDENT");
  });

  it("rejects with a reason and enforces the re-apply cooldown", async () => {
    const req = await prismaRaw.teacherVerificationRequest.findFirstOrThrow({ where: { userId: bob.id } });
    await rejectTeacherVerification(admin, { requestId: req.id, reason: "Document is unreadable.", internalNote: null });
    const row = await prismaRaw.teacherVerificationRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(row.status).toBe("REJECTED");
    expect(row.rejectionReason).toBe("Document is unreadable.");
    await expect(submitTeacherVerification(bob, application("Bob"), doc(20), null)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("revokes back to STUDENT", async () => {
    const req = await prismaRaw.teacherVerificationRequest.findFirstOrThrow({ where: { userId: alice.id, status: "APPROVED" } });
    await revokeTeacherVerification(admin, { requestId: req.id, reason: "No longer teaches there." });
    const user = await prismaRaw.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(user.role).toBe("STUDENT");
    expect(user.teacherVerifiedAt).toBeNull();
  });

  it("securely deletes documents once retention has passed", async () => {
    const docs = await prismaRaw.teacherVerificationDocument.findMany({
      where: { request: { userId: { in: [alice.id, bob.id] } }, retentionStatus: "SCHEDULED_FOR_DELETION" },
    });
    expect(docs.length).toBeGreaterThan(0);
    await prismaRaw.teacherVerificationDocument.updateMany({
      where: { id: { in: docs.map((d) => d.id) } },
      data: { deleteAfter: new Date(Date.now() - 1000) },
    });
    const purged = await purgeExpiredTeacherDocuments();
    expect(purged).toBeGreaterThanOrEqual(docs.length);
    const after = await prismaRaw.teacherVerificationDocument.findMany({ where: { id: { in: docs.map((d) => d.id) } } });
    expect(after.every((d) => d.retentionStatus === "DELETED" && d.deletedAt)).toBe(true);
    await expect(storage().get(docs[0].storageKey)).rejects.toBeTruthy();
  });

  it("refuses new applications while TEACHER_VERIFICATION_ENABLED=false", async () => {
    const dave = await makeUser("tv-dave", t);
    users.push(dave);
    process.env.TEACHER_VERIFICATION_ENABLED = "false";
    try {
      await expect(submitTeacherVerification(dave, application("Dave Closed"), doc(9), null)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      process.env.TEACHER_VERIFICATION_ENABLED = "true";
    }
  });
});
