import { prisma } from "@/lib/db";
import { parsePaperHeader, filenameExamHint, paperHeader, textKey, type DetectionResult } from "@/lib/paper-detection";
import { readPaperText } from "./paper-text";

/** Read-only: detection never creates catalogue entries or publishes a paper. */
export async function detectPaper(bytes: Buffer, mime: string, options: { filename?: string } = {}): Promise<DetectionResult> {
  const reading = await readPaperText(bytes, mime);
  const fields = parsePaperHeader(reading.text);
  const alternatives = (reading.metadataTexts ?? []).map(parsePaperHeader);
  const uncertainFields = ["collegeName", "subjectName", "subjectCode", "semesterNumber", "programName", "academicYear", "examCode"].filter((key) => {
    const values = [fields, ...alternatives].map((f) => f[key as keyof typeof fields]).filter((value) => value !== undefined);
    return new Set(values.map((value) => textKey(String(value)))).size > 1;
  });
  for (const key of ["collegeName", "subjectName", "subjectCode", "semesterNumber", "programName", "academicYear", "examCode", "sessionLabel"] as const) {
    if (fields[key] !== undefined) continue;
    const values = [...new Set(alternatives.map((f) => f[key]).filter((v) => v !== undefined))];
    if (values.length === 1) Object.assign(fields, { [key]: values[0] });
  }
  if (fields.sessionLabel) {
    const expansions = [...new Set(alternatives.map((f) => f.sessionLabel).filter((value): value is string => Boolean(value && value.length > fields.sessionLabel!.length && value.includes(fields.sessionLabel!))))];
    if (expansions.length === 1) fields.sessionLabel = expansions[0];
  }
  const listedBranches = [...new Set([fields, ...alternatives].flatMap((f) => f.branchCodes ?? (f.branchCode ? [f.branchCode] : [])))];
  if (listedBranches.length > 1) { fields.branchCodes = listedBranches; delete fields.branchCode; delete fields.branchName; }
  const warnings = [...reading.warnings];
  if (uncertainFields.length) warnings.push("The reading layouts disagreed on some fields. Confirm those details against the preview; no uncertain correction is treated as proof.");
  if (!fields.examCode && options.filename) {
    const hint = filenameExamHint(options.filename);
    if (hint) { fields.examCode = hint; warnings.push("Exam type is suggested from the file name, not printed evidence. Please verify it."); }
  }
  const header = [reading.text, ...(reading.metadataTexts ?? [])].map(paperHeader).join("\n");
  const key = textKey(header);
  const lineKeys = new Set(header.split(/\r?\n/).map(textKey));
  const colleges = await prisma.college.findMany({ select: { id: true, name: true, shortName: true } });
  const exact = colleges.filter((c) => fields.collegeName && textKey(c.name) === textKey(fields.collegeName));
  const full = colleges.filter((c) => key.includes(textKey(c.name)));
  const aliases = colleges.filter((c) => c.shortName.length >= 3 && new RegExp(`\\b${c.shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(header));
  let matches = exact.length ? exact : full.length ? full : aliases;
  if (!matches.length) {
    const candidates = [fields, ...alternatives].map((f) => f.collegeName).filter((v): v is string => Boolean(v && textKey(v).length >= 20));
    const ranked = colleges.map((c) => ({ college: c, score: Math.max(0, ...candidates.map((name) => nameSimilarity(name, c.name))) })).sort((a, b) => b.score - a.score);
    if (ranked[0]?.score >= 0.96 && ranked[0].score - (ranked[1]?.score ?? 0) >= 0.04) {
      matches = [ranked[0].college]; if (!uncertainFields.includes("collegeName")) uncertainFields.push("collegeName"); warnings.push("The college is a close OCR match to an existing catalogue entry. Please verify its name.");
    }
  }
  const college = matches.length === 1 ? matches[0] : undefined;
  if (college) fields.collegeName = college.name;
  if (matches.length > 1) warnings.push("Several colleges matched. Confirm the college instead of guessing.");
  if (college) {
    const subjects = await prisma.subject.findMany({ where: { archived: false, semester: { branch: { archived: false, program: { collegeId: college.id, archived: false } } } },
      include: { semester: { include: { branch: { include: { program: true } } } } } });
    // Expand abbreviations only when this college's relevant catalogue has
    // one meaning. Preserve the new printed code; never swap it for an old one.
    if (fields.subjectName && /^[A-Z]{2,6}$/i.test(fields.subjectName)) {
      const abbreviation = fields.subjectName.toUpperCase();
      const meanings = subjects.filter((s) => (!fields.semesterNumber || s.semester.number === fields.semesterNumber) && (!fields.programName || textKey(s.semester.branch.program.name) === textKey(fields.programName)))
        .map((s) => s.name).filter((name) => name.split(/[^a-zA-Z0-9]+/).filter((w) => w && !/^(and|of|the|in|for|to)$/i.test(w)).map((w) => w[0].toUpperCase()).join("") === abbreviation);
      const distinct = [...new Map(meanings.map((name) => [textKey(name), name])).values()];
      if (distinct.length === 1) { fields.subjectName = distinct[0]; warnings.push(`The printed abbreviation ${abbreviation} was expanded using this college’s catalogue. Check the name and printed code.`); }
    }
    const candidates = subjects.filter((s) => {
      const b = s.semester.branch;
      return (!fields.semesterNumber || s.semester.number === fields.semesterNumber)
        && (!fields.programName || textKey(b.program.name) === textKey(fields.programName))
        && (!fields.branchCode || textKey(b.code) === textKey(fields.branchCode))
        && (!fields.branchName || fields.branchCode || textKey(b.name) === textKey(fields.branchName))
        && (fields.subjectCode ? textKey(s.code) === textKey(fields.subjectCode) : fields.subjectName ? textKey(s.name) === textKey(fields.subjectName) : lineKeys.has(textKey(s.name)));
    });
    const nameConflict = candidates.length === 1 && fields.subjectName && textKey(fields.subjectName) !== textKey(candidates[0].name);
    if (nameConflict) { warnings.push(`The printed subject name differs from the catalogue name for ${fields.subjectCode}. Confirm it against the paper; the printed name has not been replaced.`); if (!uncertainFields.includes("subjectName")) uncertainFields.push("subjectName"); }
    if (!candidates.length && fields.subjectCode && subjects.some((s) => textKey(s.code) === textKey(fields.subjectCode!))) {
      warnings.push("This code exists in the catalogue, but the printed programme, semester or branch differs. Check the grouping; the catalogue has not overwritten the printed values.");
      if (!uncertainFields.includes("subjectCode")) uncertainFields.push("subjectCode");
    }
    if (candidates.length === 1 && !fields.branchCodes?.length && !nameConflict) {
      const s = candidates[0], b = s.semester.branch;
      Object.assign(fields, { subjectName: s.name, subjectCode: s.code, semesterNumber: s.semester.number, branchName: b.name, branchCode: b.code, programName: b.program.name });
      const exam = fields.examCode ? await prisma.examType.findUnique({ where: { collegeId_code: { collegeId: college.id, code: fields.examCode } } }) : null;
      return { fields, match: { collegeId: college.id, programId: b.program.id, branchId: b.id, semesterId: s.semester.id, subjectId: s.id, examTypeId: exam?.id }, method: reading.method, warnings, uncertainFields };
    }
    if (candidates.length > 1) {
      // An exact printed code may be shared by branches while its semester and
      // programme are consistent. Fill only agreed, missing metadata, never a branch.
      if (fields.subjectCode) {
        const semesterNumbers = [...new Set(candidates.map(s=>s.semester.number))];
        const programmes = [...new Map(candidates.map(s=>[textKey(s.semester.branch.program.name),s.semester.branch.program.name])).values()];
        if (!fields.semesterNumber && semesterNumbers.length===1) { fields.semesterNumber=semesterNumbers[0]; uncertainFields.push("semesterNumber"); warnings.push("Semester was filled from exact-code catalogue agreement, not printed evidence. Please confirm it."); }
        if (!fields.programName && programmes.length===1) { fields.programName=programmes[0]; uncertainFields.push("programName"); warnings.push("Programme was filled from exact-code catalogue agreement. Please confirm it."); }
      }
      warnings.push("This subject belongs to several branches or curricula. Confirm the programme and branch.");
    }
  }
  if (!fields.collegeName) warnings.push("The college name was not found. A university name alone does not identify the college.");
  if (fields.branchCodes?.length) warnings.push("Multiple branches were listed or read in this shared paper. Select a primary branch; none has been guessed.");
  else if (!fields.branchCode) warnings.push("The branch was not printed or could not be matched. Select your branch; a shared university paper cannot identify it by itself.");
  if (!fields.subjectCode) warnings.push("The subject code was not found.");
  if (!fields.subjectName) warnings.push("The subject name was not found.");
  if (!fields.semesterNumber) warnings.push("The semester was not confidently read. Select the semester printed on the paper.");
  if (!fields.programName) warnings.push("The programme was not confidently read. Select the correct programme.");
  if (!fields.examCode) warnings.push("The exam type was not found. Select it before submitting.");
  if (["ST", "CT", "PUT"].includes(fields.examCode ?? "") && !fields.sessionLabel) warnings.push("The numbered test or session was not confidently read. Check it so separate tests are grouped correctly.");
  if (!fields.academicYear) warnings.push("The academic year was not unambiguously printed. Check the year selection before submitting.");
  return { fields, method: reading.method, warnings, uncertainFields };
}

/** Strict full-name similarity; short aliases never receive fuzzy matching. */
function nameSimilarity(a: string, b: string) {
  const x=textKey(a), y=textKey(b);let row=Array.from({length:y.length+1},(_,i)=>i);
  for(let i=1;i<=x.length;i++){const next=[i];for(let j=1;j<=y.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(x[i-1]===y[j-1]?0:1));row=next;}
  return 1-row[y.length]/Math.max(x.length,y.length,1);
}
