import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prismaRaw } from "@/lib/db";
import { submitPaper } from "@/server/services/uploads";
import { decide } from "@/server/services/moderation";
import type { SessionUser } from "@/lib/auth";

/**
 * Concurrency regression for the duplicate guard: several identical uploads
 * fired at once must produce exactly one paper, and a NULL session label must
 * not split one exam into several sessions.
 */
const tag = randomUUID().slice(0, 8);
let ids: Record<string, string> = {};
let actor: SessionUser;

function png(variant: number) {
  // A valid PNG signature followed by bytes that differ per variant.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(`race-${tag}-${variant}`),
  ]);
}

function metadata(overrides: Record<string, unknown> = {}) {
  return {
    collegeId: ids.college,
    programId: ids.program,
    branchId: ids.branch,
    semesterId: ids.semester,
    subjectId: ids.subject,
    examTypeId: ids.examType,
    academicYear: 2019,
    sessionLabel: "",
    setLabel: "Set A",
    notes: "",
    ...overrides,
  } as never;
}

beforeAll(async () => {
  const college = await prismaRaw.college.create({
    data: { slug: `race-${tag}`, name: `Race ${tag}`, shortName: "RACE", city: "X", state: "Y", university: "Z" },
  });
  const program = await prismaRaw.program.create({ data: { collegeId: college.id, slug: "btech", name: "B.Tech" } });
  const branch = await prismaRaw.branch.create({ data: { programId: program.id, slug: "cse", name: "CSE", code: "CSE" } });
  const semester = await prismaRaw.semester.create({ data: { branchId: branch.id, number: 1 } });
  const subject = await prismaRaw.subject.create({
    data: { semesterId: semester.id, slug: "maths", name: `Maths ${tag}`, code: "MA101" },
  });
  const examType = await prismaRaw.examType.create({ data: { collegeId: college.id, code: "END_SEM", name: "End Sem" } });
  const user = await prismaRaw.user.create({
    data: { email: `race-${tag}@example.test`, name: "Racer", passwordHash: "x", emailVerifiedAt: new Date() },
  });
  const admin = await prismaRaw.user.create({
    data: { email: `race-admin-${tag}@example.test`, name: "Admin", passwordHash: "x", role: "PLATFORM_ADMIN", emailVerifiedAt: new Date() },
  });
  ids = { admin: admin.id, college: college.id, program: program.id, branch: branch.id, semester: semester.id, subject: subject.id, examType: examType.id, user: user.id };
  actor = {
    id: user.id, email: user.email, name: user.name, role: "STUDENT", collegeId: null,
    trustLevel: "NEW", emailVerifiedAt: new Date(), totpConfirmedAt: null, status: "ACTIVE", sessionId: "test",
  };
});

afterAll(async () => {
  if (!ids.college) return;
  await prismaRaw.paper.deleteMany({ where: { uploadedById: ids.user } });
  await prismaRaw.college.delete({ where: { id: ids.college } }).catch(() => undefined);
  await prismaRaw.user.delete({ where: { id: ids.user } }).catch(() => undefined);
  await prismaRaw.user.delete({ where: { id: ids.admin } }).catch(() => undefined);
  await prismaRaw.$disconnect();
});

describe("concurrent uploads", () => {
  it("accepts exactly one of several identical files sent at once", async () => {
    const bytes = png(1);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        submitPaper({ user: actor, metadata: metadata(), file: { name: "a.png", type: "image/png", bytes } }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter(
      (r) => r.status === "rejected" && (r.reason as { code?: string }).code === "CONFLICT",
    );
    expect(ok).toHaveLength(1);
    expect(refused).toHaveLength(5);
  });

  it("keeps one exam session and one paper per slot when different files race for it", async () => {
    const meta = metadata({ academicYear: 2020 });
    const results = await Promise.allSettled(
      [2, 3, 4, 5].map((variant) =>
        submitPaper({ user: actor, metadata: meta, file: { name: "b.png", type: "image/png", bytes: png(variant) } }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const sessions = await prismaRaw.examSession.count({
      where: { subjectId: ids.subject, examTypeId: ids.examType, academicYear: 2020, sessionLabel: null },
    });
    expect(sessions).toBe(1);
    const papers = await prismaRaw.paper.count({
      where: { paperSet: { examSession: { subjectId: ids.subject, academicYear: 2020 } } },
    });
    expect(papers).toBe(1);
  });

  it("still allows a different set in the same slot", async () => {
    const result = await submitPaper({
      user: actor,
      metadata: metadata({ academicYear: 2020, setLabel: "Set B" }),
      file: { name: "c.png", type: "image/png", bytes: png(9) },
    });
    expect(result.paperId).toBeTruthy();
  });

  it("lets a moderator publish a paper that was held for the current exam cycle", async () => {
    const year = new Date().getFullYear();
    const { paperId } = await submitPaper({
      user: actor,
      metadata: metadata({ academicYear: year }),
      file: { name: "d.png", type: "image/png", bytes: png(20) },
    });
    const held = await prismaRaw.paper.findUniqueOrThrow({ where: { id: paperId } });
    expect(held.status).toBe("RESTRICTED");

    const admin = { ...actor, id: ids.admin, role: "PLATFORM_ADMIN" as const, totpConfirmedAt: new Date() };
    // Without the reviewer confirming the exam has been held, publishing is refused.
    await expect(decide(admin, { paperId, action: "PUBLISH" } as never)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await decide(admin, { paperId, action: "PUBLISH", examClassification: "PAST" } as never);
    const published = await prismaRaw.paper.findUniqueOrThrow({ where: { id: paperId } });
    expect(published.status).toBe("PUBLISHED");
    expect(published.restricted).toBe(false);
    expect(published.examClassification).toBe("PAST");
  });
});
