import { describe, it, expect } from "vitest";
import { branchCodeFromName, branchInputMatchesExisting } from "@/lib/upload-details";
import { catalogueDraftSchema } from "@/server/services/automatic-catalogue";
const draft = { collegeName: "New Engineering College", programName: "B.Tech", branchName: "Computer Science & Engineering", semesterNumber: 5, subjectName: "Algorithms", subjectCode: "BCS503", examCode: "ST" };
describe("simple manual branch entry", () => {
  it("reuses known full names and abbreviations", () => { expect(branchCodeFromName("Computer Science & Engineering")).toBe("CSE"); expect(branchCodeFromName("IT")).toBe("IT"); });
  it("makes a shorthand for a new user-entered branch", () => { expect(branchCodeFromName("Cyber Security Engineering")).toBe("CSE"); expect(branchCodeFromName("IoT")).toBe("IOT"); expect(branchCodeFromName("Cybersecurity")).toBe("CYBERSECURITY"); });
  it("does not invent a branch for an empty input", () => { expect(branchCodeFromName("  ")).toBe(""); expect(catalogueDraftSchema.safeParse({ ...draft, branchName: "" }).success).toBe(false); });
  it("accepts manual details without requiring a separate branch-code question", () => { expect(catalogueDraftSchema.parse(draft).branchCode).toBe("CSE"); expect(catalogueDraftSchema.parse({ ...draft, branchCode: "" }).branchCode).toBe("CSE"); });
  it("preserves an explicit edited code and rejects invalid codes", () => { expect(catalogueDraftSchema.parse({ ...draft, branchCode: "CS" }).branchCode).toBe("CS"); expect(catalogueDraftSchema.safeParse({ ...draft, branchCode: "<script>" }).success).toBe(false); });
});

it("recognises known branch aliases without conflating unrelated names", () => {
 expect(branchInputMatchesExisting({ branchName: "Internet of Things", branchCode: "IOT" }, { name: "Computer Science (Internet of Things)", code: "IOT" })).toBe(true);
 expect(branchInputMatchesExisting({ branchName: "Cyber Security Engineering", branchCode: "CSE" }, { name: "Computer Science & Engineering", code: "CSE" })).toBe(false);
});
