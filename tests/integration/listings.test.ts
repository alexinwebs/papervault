import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prismaRaw } from "@/lib/db";
import { submitPaper } from "@/server/services/uploads";
import { setPaperListings, siblingSubjects, underSubject } from "@/server/services/listings";
import type { SessionUser } from "@/lib/auth";

/** One paper, several branches: CSE upload also listed under IT and DS. */
const tag = randomUUID().slice(0, 8);
const ids: Record<string, string> = {};
let student: SessionUser;
let admin: SessionUser;
let otherMod: SessionUser;
let paperId = "";

const session = (u: { id: string; email: string; name: string }, extra: Partial<SessionUser> = {}): SessionUser => ({
  id: u.id, email: u.email, name: u.name, role: "STUDENT", collegeId: null, trustLevel: "NEW",
  emailVerifiedAt: new Date(), totpConfirmedAt: new Date(), status: "ACTIVE", sessionId: "test", ...extra,
});

beforeAll(async () => {
  const college = await prismaRaw.college.create({
    data: { slug: `lst-${tag}`, name: `Listing ${tag}`, shortName: "LST", city: "X", state: "Y", university: "Z" },
  });
  const other = await prismaRaw.college.create({
    data: { slug: `lst2-${tag}`, name: `Listing Other ${tag}`, shortName: "LS2", city: "X", state: "Y", university: "Z" },
  });
  const program = await prismaRaw.program.create({ data: { collegeId: college.id, slug: "btech", name: "B.Tech" } });
  const otherProgram = await prismaRaw.program.create({ data: { collegeId: other.id, slug: "btech", name: "B.Tech" } });
  const mkSubject = async (programId: string, code: string, subjectName: string, subjectCode: string) => {
    const branch = await prismaRaw.branch.create({ data: { programId, slug: code.toLowerCase(), name: code, code } });
    const semester = await prismaRaw.semester.create({ data: { branchId: branch.id, number: 4 } });
    const subject = await prismaRaw.subject.create({
      data: { semesterId: semester.id, slug: "dbms", name: subjectName, code: subjectCode },
    });
    return { branch, semester, subject };
  };
  const cse = await mkSubject(program.id, "CSE", "Database Management Systems", "KCS501");
  const it_ = await mkSubject(program.id, "IT", "Database Management Systems", "KCS501");
  const ds = await mkSubject(program.id, "DS", "Database-Management systems", "KDS501");
  const me = await mkSubject(program.id, "ME", "Thermodynamics", "KME401");
  const foreign = await mkSubject(otherProgram.id, "CSE", "Database Management Systems", "KCS501");
  const examType = await prismaRaw.examType.create({ data: { collegeId: college.id, code: "END_SEM", name: "End Sem" } });
  const mk = (n: string, role = "STUDENT") =>
    prismaRaw.user.create({
      data: { email: `${n}-${tag}@example.test`, name: n, passwordHash: "x", role, emailVerifiedAt: new Date() },
    });
  student = session(await mk("lst-student"));
  admin = session(await mk("lst-admin", "PLATFORM_ADMIN"), { role: "PLATFORM_ADMIN" });
  otherMod = session(await mk("lst-mod", "MODERATOR"), { role: "MODERATOR", collegeId: other.id });
  Object.assign(ids, {
    college: college.id, other: other.id, program: program.id, examType: examType.id,
    cseBranch: cse.branch.id, cseSemester: cse.semester.id, cse: cse.subject.id,
    it: it_.subject.id, ds: ds.subject.id, me: me.subject.id, foreign: foreign.subject.id,
  });
});

afterAll(async () => {
  await prismaRaw.paper.deleteMany({ where: { uploadedById: student.id } });
  await prismaRaw.college.deleteMany({ where: { id: { in: [ids.college, ids.other] } } });
  await prismaRaw.user.deleteMany({ where: { id: { in: [student.id, admin.id, otherMod.id] } } });
  await prismaRaw.$disconnect();
});

const upload = (alsoSubjectIds: string[], seed: string) =>
  submitPaper({
    user: student,
    metadata: {
      collegeId: ids.college, programId: ids.program, branchId: ids.cseBranch, semesterId: ids.cseSemester,
      subjectId: ids.cse, examTypeId: ids.examType, academicYear: 2023, sessionLabel: "", setLabel: seed,
      notes: "", alsoSubjectIds,
    } as never,
    file: {
      name: "a.png",
      type: "image/png",
      bytes: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`${tag}-${seed}`)]),
    },
  });

const listed = async (id: string) =>
  (await prismaRaw.paperListing.findMany({ where: { paperId: id } })).map((l) => l.subjectId).sort();

describe("multi-branch papers", () => {
  it("finds the same subject in sibling branches by code or name, never other colleges", async () => {
    const siblings = (await siblingSubjects(ids.cse)).map((s) => s.id).sort();
    expect(siblings).toEqual([ids.it, ids.ds].sort());
  });

  it("lists an upload under extra branches, ignoring the primary and duplicates", async () => {
    ({ paperId } = await upload([ids.it, ids.it, ids.ds, ids.cse], "Set A"));
    expect(await listed(paperId)).toEqual([ids.it, ids.ds].sort());
  });

  it("refuses extra subjects from another college", async () => {
    await expect(upload([ids.foreign], "Set B")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("matches the paper under each listed subject, but not unrelated ones", async () => {
    const find = (subjectId: string) =>
      prismaRaw.paper.count({ where: { id: paperId, ...underSubject(subjectId) } });
    expect(await find(ids.cse)).toBe(1);
    expect(await find(ids.it)).toBe(1);
    expect(await find(ids.ds)).toBe(1);
    expect(await find(ids.me)).toBe(0);
    expect(await prismaRaw.paper.count({ where: { id: paperId, ...underSubject(ids.it, "MID_SEM") } })).toBe(0);
    expect(await prismaRaw.paper.count({ where: { id: paperId, ...underSubject(ids.it, "END_SEM") } })).toBe(1);
  });

  it("lets an admin change the branches later, and audits it", async () => {
    await setPaperListings(admin, { paperId, subjectIds: [ids.me] });
    expect(await listed(paperId)).toEqual([ids.me]);
    await setPaperListings(admin, { paperId, subjectIds: [] });
    expect(await listed(paperId)).toEqual([]);
    expect(
      await prismaRaw.auditLog.count({ where: { entityId: paperId, action: "paper.listings_updated" } }),
    ).toBe(2);
  });

  it("keeps moderators of other colleges out", async () => {
    await expect(setPaperListings(otherMod, { paperId, subjectIds: [ids.it] })).rejects.toBeTruthy();
    expect(await listed(paperId)).toEqual([]);
  });
});
