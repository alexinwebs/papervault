import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), subject: vi.fn(), exam: vi.fn(), upsert: vi.fn(), audit: vi.fn(), verified: vi.fn() }));
vi.mock("@/lib/auth", () => ({ assertVerifiedEmail: mocks.verified }));
vi.mock("@/lib/db", () => ({ prisma: { paper: { findMany: mocks.findMany }, subject: { findFirst: mocks.subject }, examType: { findFirst: mocks.exam }, paperRequest: { upsert: mocks.upsert } } }));
vi.mock("@/server/repositories/papers", () => ({ PUBLIC_PAPER_WHERE: { status: "PUBLISHED", restricted: false } }));
vi.mock("@/server/services/listings", () => ({ underSubject: (subjectId: string) => ({ OR: [{ paperSet: { examSession: { subjectId } } }, { listings: { some: { subjectId } } }] }) }));
vi.mock("@/server/services/audit", () => ({ recordAudit: mocks.audit }));
import { availableRequestSlots } from "@/server/services/request-availability";
import { requestPaper } from "@/server/services/requests";
import { requestSlotKey } from "@/lib/request-slots";
const slot = { subjectId: "subject-1", examTypeId: "exam-1", academicYear: 2024 };
beforeEach(() => {
  vi.clearAllMocks(); mocks.findMany.mockResolvedValue([]);
  mocks.subject.mockResolvedValue({ semester: { branch: { program: { collegeId: "college-1" } } } });
  mocks.exam.mockResolvedValue({ id: "exam-1" }); mocks.upsert.mockResolvedValue({ id: "request-1" });
});
describe("public request availability", () => {
  it("does not query for an empty set", async () => {
    expect((await availableRequestSlots([])).size).toBe(0); expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("uses only public files and resolves cross-listed requests", async () => {
    mocks.findMany.mockResolvedValue([{ paperSet: { examSession: slot }, listings: [{ subjectId: "sibling" }] }]);
    const available = await availableRequestSlots([slot]);
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({ status: "PUBLISHED", restricted: false });
    expect(available.has(requestSlotKey({ ...slot, subjectId: "sibling" }))).toBe(true);
  });
  it("deduplicates and bounds SQL batches", async () => {
    await availableRequestSlots([...Array.from({ length: 51 }, (_, i) => ({ ...slot, subjectId: `s${i}` })), slot, slot]);
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.findMany.mock.calls[0][0].where.OR).toHaveLength(50);
  });
});
describe("request safety", () => {
  it("checks verified email and account standing before touching request data", async () => {
    mocks.verified.mockImplementationOnce(() => { throw new Error("Confirm your email"); });
    await expect(requestPaper({ id: "student" } as never, slot)).rejects.toThrow("Confirm your email");
    expect(mocks.subject).not.toHaveBeenCalled();
  });
  it("rejects archived or missing subjects", async () => {
    mocks.subject.mockResolvedValue(null);
    await expect(requestPaper({ id: "student" } as never, slot)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects exam types from a different college", async () => {
    mocks.exam.mockResolvedValue(null);
    await expect(requestPaper({ id: "student" } as never, slot)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects future requests", async () => {
    await expect(requestPaper({ id: "student" } as never, { ...slot, academicYear: new Date().getFullYear() + 1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
  it("retains an unfulfilled request while no public copy exists", async () => {
    await requestPaper({ id: "student" } as never, slot);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ create: { fulfilled: false }, update: { fulfilled: false } });
    expect(mocks.exam.mock.calls[0][0].where.collegeId).toBe("college-1");
  });
});
