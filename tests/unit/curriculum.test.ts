import { describe, expect, it } from "vitest";
import { CURRICULUM, curriculumFor, curriculumRows, curriculumSubjectCount } from "@/data/curriculum";
import { parseSubjectRows } from "@/server/services/admin";

describe("curriculum catalogue", () => {
  it("covers every semester of every branch it claims", () => {
    for (const [key, map] of Object.entries(CURRICULUM)) {
      const semesters = Object.keys(map).map(Number).sort((a, b) => a - b);
      expect(semesters.length, key).toBeGreaterThan(0);
      // No gaps: semester numbers run 1..n with nothing missing.
      expect(semesters, key).toEqual(
        Array.from({ length: semesters.length }, (_, i) => i + 1),
      );
      for (const semester of semesters) {
        expect(map[semester].length, `${key} sem ${semester}`).toBeGreaterThan(0);
      }
    }
  });

  it("never repeats a subject code inside one semester", () => {
    for (const [key, map] of Object.entries(CURRICULUM)) {
      for (const [semester, list] of Object.entries(map)) {
        const codes = list.map(([, code]) => code);
        expect(new Set(codes).size, `${key} sem ${semester}`).toBe(codes.length);
      }
    }
  });

  it("shares the common first year across every B.Tech branch", () => {
    const cse = curriculumFor("btech", "CSE")!;
    const me = curriculumFor("btech", "ME")!;
    expect(cse[1]).toEqual(me[1]);
    expect(cse[2]).toEqual(me[2]);
    // Third semester is where branches diverge.
    expect(cse[3]).not.toEqual(me[3]);
  });

  it("is case-insensitive on the branch code and unknown keys return null", () => {
    expect(curriculumFor("btech", "cse")).toBe(curriculumFor("btech", "CSE"));
    expect(curriculumFor("btech", "NOPE")).toBeNull();
  });

  it("flattens to rows ordered by semester", () => {
    const map = curriculumFor("mca", "MCA")!;
    const rows = curriculumRows(map);
    expect(rows.length).toBe(curriculumSubjectCount(map));
    expect(rows.map((r) => r.semester)).toEqual([...rows.map((r) => r.semester)].sort((a, b) => a - b));
  });
});

describe("paste-to-import parser", () => {
  it("reads comma, pipe and tab separated rows in any column order", () => {
    const { rows, rejected } = parseSubjectRows(
      [
        "5, KCS501, Database Management Systems",
        "5 | KCS502 | Compiler Design",
        "Design and Analysis of Algorithms\tKCS503\t5",
      ].join("\n"),
    );
    expect(rejected).toEqual([]);
    expect(rows).toEqual([
      { semester: 5, code: "KCS501", name: "Database Management Systems" },
      { semester: 5, code: "KCS502", name: "Compiler Design" },
      { semester: 5, code: "KCS503", name: "Design and Analysis of Algorithms" },
    ]);
  });

  it("falls back to a code-then-name pattern with no separator", () => {
    const { rows } = parseSubjectRows("KCS601 Software Engineering", 6);
    expect(rows).toEqual([{ semester: 6, code: "KCS601", name: "Software Engineering" }]);
  });

  it("uses the default semester only when the line does not say", () => {
    const { rows } = parseSubjectRows("KCS301, Data Structures\n4, KCS401, Operating Systems", 3);
    expect(rows.map((r) => r.semester)).toEqual([3, 4]);
  });

  it("accepts a 'Semester 5' style cell", () => {
    const { rows } = parseSubjectRows("Semester 5 | KCS501 | Database Management Systems");
    expect(rows[0].semester).toBe(5);
  });

  it("skips header rows, blank lines and duplicate codes", () => {
    const { rows, rejected } = parseSubjectRows(
      ["S.No, Code, Subject", "", "5, KCS501, DBMS", "5, KCS501, DBMS again"].join("\n"),
    );
    expect(rows).toHaveLength(1);
    expect(rejected).toEqual([]);
  });

  it("reports lines it cannot read instead of guessing", () => {
    const { rows, rejected } = parseSubjectRows("just some prose\n5, KCS501, DBMS");
    expect(rows).toHaveLength(1);
    expect(rejected).toEqual(["just some prose"]);
  });

  it("rejects a row with no semester and no default", () => {
    const { rows, rejected } = parseSubjectRows("KCS501, Database Management Systems");
    expect(rows).toEqual([]);
    expect(rejected).toHaveLength(1);
  });
});
