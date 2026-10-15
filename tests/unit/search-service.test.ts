import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ college: { findMany: vi.fn() }, examType: { findMany: vi.fn() }, branch: { findMany: vi.fn() }, subject: { findMany: vi.fn() }, paper: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/server/repositories/papers", () => ({ PUBLIC_PAPER_WHERE: { status: "PUBLISHED", restricted: false }, paperCardInclude: {} }));
import { searchEverything } from "@/server/services/search";
beforeEach(() => {
  vi.clearAllMocks();
  for (const model of [db.college, db.examType, db.branch, db.subject, db.paper]) model.findMany.mockResolvedValue([]);
  db.paper.count.mockResolvedValue(0);
});
describe("search relevance and pagination", () => {
  it("browses public papers without a query and clamps out-of-range pages", async () => {
    db.paper.count.mockResolvedValue(25);
    const result = await searchEverything("", 99);
    expect(result.page).toBe(2); expect(result.pages).toBe(2);
    expect(db.paper.findMany.mock.calls[0][0]).toMatchObject({ where: { status: "PUBLISHED", restricted: false }, skip: 20, take: 20 });
  });
  it("does not drop an unknown subject term when a college matches", async () => {
    db.college.findMany.mockResolvedValue([{ id: "rkgit", shortName: "RKGIT", name: "Raj Kumar" }]);
    await searchEverything("RKGIT no-such-subject");
    const args = db.paper.count.mock.calls[0][0];
    expect(JSON.stringify(args)).toContain("no-such-subject");
    expect(JSON.stringify(args)).toContain("rkgit");
  });
  it("retains college and branch constraints together, including cross-listings", async () => {
    db.college.findMany.mockResolvedValue([{ id: "college-1", shortName: "RKGIT", name: "Raj Kumar" }]);
    db.branch.findMany.mockResolvedValue([{ id: "branch-1", code: "CSE" }]);
    await searchEverything("RKGIT CSE DBMS");
    const where = db.paper.count.mock.calls[0][0].where;
    for (const clause of where.OR) {
      expect(JSON.stringify(clause)).toContain("college-1");
      expect(JSON.stringify(clause)).toContain("branch-1");
      expect(JSON.stringify(clause)).toContain("Database Management Systems");
    }
  });
  it("does not restrict papers to the eight UI suggestion IDs", async () => {
    db.subject.findMany.mockResolvedValue([{ id: "one-suggestion" }]);
    await searchEverything("DBMS");
    expect(JSON.stringify(db.paper.count.mock.calls[0][0])).not.toContain("one-suggestion");
  });
  it("requires every free-text term rather than first-word title matching", async () => {
    await searchEverything("unusual unrelated");
    expect(db.paper.count.mock.calls[0][0].where.AND).toHaveLength(2);
  });
  it("prioritizes an exact college short name over broad name suggestions", async () => {
    db.college.findMany.mockResolvedValueOnce([{ id: "other", shortName: "OTHER", name: "Engineering College" }]).mockResolvedValueOnce([{ id: "rkgit", shortName: "RKGIT", name: "Raj Kumar Goel Institute of Technology" }]);
    const result = await searchEverything("RKGIT Engineering Physics");
    expect(result.colleges[0].id).toBe("rkgit");
    const where = JSON.stringify(db.paper.count.mock.calls[0][0]);
    expect(where).toContain("rkgit"); expect(where).not.toContain('"other"');
  });
  it("keeps subject terms that also occur in a college name when only its short name was entered", async () => {
    db.college.findMany.mockResolvedValue([{ id: "rkgit", shortName: "RKGIT", name: "Raj Kumar Technology" }]);
    await searchEverything("RKGIT Technology");
    expect(JSON.stringify(db.paper.count.mock.calls[0][0])).toContain('"contains":"Technology"');
  });
  it("does not scope to a college merely containing a generic subject word", async () => {
    db.college.findMany.mockResolvedValue([{ id: "engineering-college", shortName: "EC", name: "Engineering College" }]);
    db.subject.findMany.mockResolvedValue([{ id: "physics" }]);
    await searchEverything("Engineering Physics");
    expect(JSON.stringify(db.paper.count.mock.calls[0][0])).not.toContain("engineering-college");
  });
});
