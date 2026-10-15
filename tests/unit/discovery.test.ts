import { describe, expect, it } from "vitest";
import { parsePaperSearch, subjectSearchTerms } from "@/lib/search-query";
import { requestSlotKey } from "@/lib/request-slots";
import { verificationDescription } from "@/lib/verification";

describe("paper search normalization", () => {
  it("normalizes code separators and semester exam aliases", () => {
    expect(parsePaperSearch("RKGIT BCS-503 End Semester 2025-26")).toEqual({ tokens: ["RKGIT", "BCS503", "END_SEM", "2025-26"], words: ["RKGIT", "BCS503", "END_SEM"], years: [2025] });
    expect(parsePaperSearch("mid-sem").words).toEqual(["MID_SEM"]);
  });
  it("accepts full session end years and bounds tokens", () => {
    expect(parsePaperSearch("2025-2026").years).toEqual([2025]);
    expect(parsePaperSearch("aa bb cc dd ee ff gg hh ii jj").tokens).toHaveLength(8);
  });
  it("ignores empty tokens and deduplicates", () => {
    expect(parsePaperSearch("  DBMS, DBMS / 2024 ").tokens).toEqual(["DBMS", "2024"]);
  });
  it("expands explicit abbreviations, not ambiguous branch codes", () => {
    expect(subjectSearchTerms("DAA")).toContain("Design and Analysis of Algorithms");
    expect(subjectSearchTerms("dbms")).toContain("Database Management Systems");
    expect(subjectSearchTerms("DS")).toEqual(["DS"]);
  });
  it("matches catalogue code forms without changing printed metadata", () => {
    expect(subjectSearchTerms("BCS503")).toEqual(["BCS503", "BCS-503"]);
  });
});
describe("request slot identities", () => {
  it("keeps subject, exam and year separate without delimiter collisions", () => {
    expect(requestSlotKey({ subjectId: "a|b", examTypeId: "c", academicYear: 2024 })).not.toBe(requestSlotKey({ subjectId: "a", examTypeId: "b|c", academicYear: 2024 }));
  });
});
describe("verification explanations", () => {
  it("does not imply official endorsement or certainty", () => {
    expect(verificationDescription("COLLEGE_VERIFIED")).toContain("not proof of official");
    expect(verificationDescription("MODERATOR_VERIFIED")).toContain("not a guarantee");
  });
  it("handles unknown and restricted labels safely", () => {
    expect(verificationDescription("surprise")).toContain("Unverified");
    expect(verificationDescription("COLLEGE_VERIFIED", true)).toContain("Restricted");
  });
});
