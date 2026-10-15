import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prismaRaw } from "@/lib/db";
import { requestPaper, requestCount, wantedPapers } from "@/server/services/requests";
import { myLibrary } from "@/server/services/library";
import { searchEverything } from "@/server/services/search";
import type { SessionUser } from "@/lib/auth";

const tag = randomUUID().slice(0, 8), ids: Record<string, string> = {};
let actor: SessionUser;
beforeAll(async () => {
  const college = await prismaRaw.college.create({ data: { slug: `discovery-${tag}`, name: `Discovery College ${tag}`, shortName: `D${tag}`, city: "Test", state: "Test", university: "Test" } });
  const program = await prismaRaw.program.create({ data: { collegeId: college.id, slug: "btech", name: "B.Tech" } });
  const branch = await prismaRaw.branch.create({ data: { programId: program.id, slug: "cse", name: "Computer Science", code: "CSE" } });
  const semester = await prismaRaw.semester.create({ data: { branchId: branch.id, number: 5 } });
  const subject = await prismaRaw.subject.create({ data: { semesterId: semester.id, slug: "daa", name: "Design and Analysis of Algorithms", code: "BCS-503" } });
  const sibling = await prismaRaw.subject.create({ data: { semesterId: semester.id, slug: "shared-daa", name: "Shared Algorithms", code: "BCS503" } });
  const exam = await prismaRaw.examType.create({ data: { collegeId: college.id, code: "ST", name: "Sessional test" } });
  const user = await prismaRaw.user.create({ data: { email: `discovery-${tag}@example.test`, name: "Private Requester", passwordHash: "unused", emailVerifiedAt: new Date() } });
  actor = { ...user, role: "STUDENT", status: "ACTIVE", trustLevel: "NEW", sessionId: "test" } as SessionUser;
  Object.assign(ids, { college: college.id, slug: college.slug, shortName: college.shortName, subject: subject.id, sibling: sibling.id, exam: exam.id, user: user.id });
});
afterAll(async () => {
  if (ids.user) await prismaRaw.paper.deleteMany({ where: { uploadedById: ids.user } });
  if (ids.college) await prismaRaw.college.delete({ where: { id: ids.college } });
  if (ids.user) await prismaRaw.user.delete({ where: { id: ids.user } });
  await prismaRaw.$disconnect();
});
const slot = () => ({ subjectId: ids.subject, examTypeId: ids.exam, academicYear: 2024 });
describe("real database discovery and request lifecycle", () => {
  it("deduplicates demand and publishes only aggregate request information", async () => {
    await requestPaper(actor, slot()); await requestPaper(actor, slot());
    expect(await requestCount(slot())).toBe(1);
    const board = await wantedPapers(ids.slug);
    expect(board).toHaveLength(1); expect(board[0].requests).toBe(1);
    expect(JSON.stringify(board)).not.toContain(actor.email);
    expect(JSON.stringify(board)).not.toContain(actor.name);
  });
  it("finds hyphenated codes and explicit aliases inside the correct campus", async () => {
    const session = await prismaRaw.examSession.create({ data: { subjectId: ids.subject, examTypeId: ids.exam, academicYear: 2024, sessionLabel: "ST-1" } });
    const set = await prismaRaw.paperSet.create({ data: { examSessionId: session.id, label: "Set A" } });
    const paper = await prismaRaw.paper.create({ data: { paperSetId: set.id, uploadedById: actor.id, title: "Algorithms", status: "PENDING_REVIEW", examClassification: "PAST" } });
    ids.paper = paper.id;
    await prismaRaw.paperListing.create({ data: { paperId: paper.id, subjectId: ids.sibling } });
    await requestPaper(actor, { ...slot(), subjectId: ids.sibling });
    expect((await searchEverything(`${ids.shortName} CSE DAA ST 2024`)).paperTotal).toBe(0);
    // Simulate the old upload-time bug: flags must not make a private file look available.
    await prismaRaw.paperRequest.updateMany({ where: { requestedById: actor.id }, data: { fulfilled: true } });
    expect((await myLibrary(actor.id)).requests.every(r => !r.fulfilled)).toBe(true);
    expect(await wantedPapers(ids.slug)).toHaveLength(2);
    await prismaRaw.paper.update({ where: { id: paper.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    expect((await searchEverything(`${ids.shortName} CSE DAA ST 2024`)).paperTotal).toBe(1);
    expect((await searchEverything(`${ids.shortName} BCS503`)).paperTotal).toBe(1);
    expect((await searchEverything(`${ids.shortName} nonexistent-subject`)).paperTotal).toBe(0);
  });
  it("fulfills only public copies, including cross-listings, and reopens when restricted/deleted", async () => {
    expect(await wantedPapers(ids.slug)).toHaveLength(0);
    expect(await requestCount(slot())).toBe(0);
    expect((await myLibrary(actor.id)).requests.every(r => r.fulfilled)).toBe(true);
    await prismaRaw.paper.update({ where: { id: ids.paper }, data: { restricted: true } });
    expect(await wantedPapers(ids.slug)).toHaveLength(2);
    await prismaRaw.paper.update({ where: { id: ids.paper }, data: { restricted: false, deletedAt: new Date() } });
    expect(await wantedPapers(ids.slug)).toHaveLength(2);
    await prismaRaw.paper.update({ where: { id: ids.paper }, data: { deletedAt: null } });
  });
});
