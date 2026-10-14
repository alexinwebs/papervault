import { describe, expect, it } from "vitest";
import { parsePaperHeader, filenameExamHint } from "@/lib/paper-detection";
describe("evidence-based paper metadata", () => {
  it("reads printed labels, roman semester, branch and exam", () => {
    expect(parsePaperHeader(`College: New Horizon College\nUniversity: AKTU\nB.Tech CSE\nSemester: V\nSubject: Database Management Systems\nSubject Code: BCS-501\nEND-SEM 2024\nQ1. Explain relational algebra.`)).toMatchObject({collegeName: "New Horizon College", university: "AKTU", programName: "B.Tech", branchCode: "CSE", semesterNumber: 5, subjectName: "Database Management Systems", subjectCode: "BCS501", examCode: "END_SEM", academicYear: 2024});
  });
  it("does not invent a college from a university or semester from questions", () => {
    const f = parsePaperHeader("Dr. APJ Abdul Kalam Technical University\nSubject: Physics\nQ1. A college has semester 7 students in 2025");
    expect(f.collegeName).toBeUndefined(); expect(f.semesterNumber).toBeUndefined(); expect(f.academicYear).toBeUndefined();
  });
  it("uses the session start year only for an unambiguous consecutive academic range", () => {
    expect(parsePaperHeader("Session 2024-2025\n5th semester\nPUT")).toMatchObject({semesterNumber:5, examCode:"PUT"});
    expect(parsePaperHeader("Session 2024-2025").academicYear).toBe(2024);
    expect(parsePaperHeader("Session 2024-2025 Reprinted 2023").academicYear).toBeUndefined();
  });
  it("reads code-name headings without labels", () => {
    expect(parsePaperHeader("BCS501 - Database Management Systems\nSemester 5\nST 2023")).toMatchObject({subjectCode:"BCS501", subjectName:"Database Management Systems", semesterNumber:5, examCode:"ST"});
  });
  it("reads a standalone subject heading next to its code", () => {
    expect(parsePaperHeader("Horizon Engineering College\nB.Tech CSE\nSemester V\nDatabase Management Systems\nBCS501\nEND-SEM 2024\nTime: 3 hours\nMaximum Marks: 100")).toMatchObject({subjectName:"Database Management Systems", subjectCode:"BCS501"});
  });
  it("does not mistake an exam name and year for a subject code", () => {
    for (const heading of ["END-SEM 2024", "ST 2024", "CT 2024", "PUT 2024", "AKTU 2024"]) expect(parsePaperHeader(heading).subjectCode).toBeUndefined();
  });
  it("does not choose between multiple unexplained headings", () => {
    expect(parsePaperHeader("BCS501\nFirst Possible Title\nSecond Possible Title").subjectName).toBeUndefined();
  });
  it("leaves unreadable fields empty", () => { expect(parsePaperHeader("Unreadable page")).toEqual({}); });
});

describe("scanned university headers", () => {
  const header = "7 ee a\nPrinted Page: 1 of 4\nWO Subject Code: BCSS03\nPAPER 1D-311390 Roll No:\nBTECH\n(SEM V) THEORY EXAMINATION 2025-26\nDESIGN AND ANALYSIS OF ALGORITHM\nTIME: 3 HRS M.MARKS: 70\nNote: Attempt all Sections. In case of any missing data; choose suitably |\nSECTION A\n1. Attempt all questions in brief.";
  it("keeps readable title and semester even when OCR cannot read the code", () => {
    expect(parsePaperHeader(header)).toMatchObject({subjectName:"DESIGN AND ANALYSIS OF ALGORITHM", programName:"B.Tech", semesterNumber:5, sessionLabel:"2025-26", academicYear:2025});
    expect(parsePaperHeader(header).subjectCode).toBeUndefined(); expect(parsePaperHeader(header).collegeName).toBeUndefined(); expect(parsePaperHeader(header).branchCode).toBeUndefined();
  });
  it("uses an independently recovered code without confusing the barcode with a title", () => {
    expect(parsePaperHeader("Subject Code: BCS503\n" + header)).toMatchObject({subjectCode:"BCS503",subjectName:"DESIGN AND ANALYSIS OF ALGORITHM"});
  });
  it("does not turn an arbitrary word ending in END/ST into an exam hint", () => {
    expect(filenameExamHint("DAAsem5END.pdf")).toBe("END_SEM");expect(filenameExamHint("physics-END-SEM.pdf")).toBe("END_SEM");expect(filenameExamHint("FRIEND.pdf")).toBeUndefined();expect(filenameExamHint("TEST.pdf")).toBeUndefined();
  });
});

describe("table-based sessional paper headers", () => {
 it("separates labelled cells on one line, with OCR semicolons",()=>{
  const fields=parsePaperHeader("Raj Kumar Goel Institute of Technology, Ghaziabad\nST-1 (Odd Semester) 2025-26\nB.TECH. III Year [Branch/Section: CSE, IT, DS] SEM; V\nSubject Name: DAA subject Code ; BCS503 Max. Marks : 50\nRoll No./Name: Time: 1.5 Hours\nInstructions: Attempt the questions\nSection - A");
  expect(fields).toMatchObject({subjectName:"DAA",subjectCode:"BCS503",semesterNumber:5,programName:"B.Tech",examCode:"ST",sessionLabel:"ST-1 · 2025-26",academicYear:2025});
  expect(fields.branchCode).toBeUndefined();expect(fields.branchName).toBeUndefined();expect(fields.branchCodes).toEqual(expect.arrayContaining(["CSE","IT","DS"]));
 });
 it("keeps ST-1 and ST-2 in different exam sessions",()=>{
  expect(parsePaperHeader("ST-1 Odd Semester 2025-26").sessionLabel).toBe("ST-1 · 2025-26");expect(parsePaperHeader("ST-2 Odd Semester 2025-26").sessionLabel).toBe("ST-2 · 2025-26");expect(filenameExamHint("DAAsem5ST1.pdf")).toBe("ST");
 });
 it("does not read branches or metadata from table questions",()=>{
  const f=parsePaperHeader("Subject Name: DAA Subject Code: BCS503\nSection = A\nQ.1 Branch: IT Semester 9");expect(f.branchCode).toBeUndefined();expect(f.semesterNumber).toBeUndefined();expect(f.subjectName).toBe("DAA");
 });
});

it("separates adjacent college, university, programme and branch table cells",()=>{expect(parsePaperHeader("College: Clear Scan College University: AKTU Program: B.Tech Branch: CSE Semester: V Subject: Algorithms Subject Code: BCS503 ST-1 2025-2026")).toMatchObject({collegeName:"Clear Scan College",university:"AKTU",programName:"B.Tech",branchCode:"CSE",semesterNumber:5,subjectName:"Algorithms",subjectCode:"BCS503",academicYear:2025});});
