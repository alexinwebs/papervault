/** Serializable detection data shared by the upload UI and server. */
export type CatalogueDraft = {
  collegeName: string; programName: string; branchName: string; branchCode: string;
  semesterNumber: number; subjectName: string; subjectCode: string; examCode: string;
  university?: string;
};
export type DetectedFields = Partial<CatalogueDraft> & { academicYear?: number; sessionLabel?: string; branchCodes?: string[] };
export type DetectionResult = {
  fields: DetectedFields;
  match?: { collegeId: string; programId: string; branchId: string; semesterId: string; subjectId: string; examTypeId?: string };
  method: "text" | "ocr" | "none";
  warnings: string[];
  uncertainFields?: string[];
};
export const textKey = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");

const romans: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
export const branchNames: Record<string, string> = { CSE: "Computer Science & Engineering", IT: "Information Technology", ECE: "Electronics & Communication Engineering", EE: "Electrical Engineering", ME: "Mechanical Engineering", CE: "Civil Engineering", AIML: "Artificial Intelligence & Machine Learning", DS: "Data Science", IOT: "Internet of Things" };

/** Read evidence, not guesses. Only the header is used for metadata. */
export function parsePaperHeader(text: string): DetectedFields {
  const header = paperHeader(text).replace(/\b(?:ingtitute|lnstitute|institule)\b/gi, "Institute");
  const lines = header.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const field = (label: string) => {
    const value = header.match(new RegExp(`\\b(?:${label})\\s*[:;=|—-]\\s*([^\\n]{1,180})`, "i"))?.[1];
    // Table columns often share an OCR line. Stop at the next labelled cell.
    return value?.split(/\b(?:college(?:\s*name)?|institute(?:\s*name)?|institution(?:\s*name)?|university(?:\s*name)?|program(?:me)?|branch(?:\s*name|\s*\/\s*section)?|department|academic\s*year|exam\s*type|session|subject\s*(?:name|title|code)|course\s*(?:name|code)|paper\s*(?:name|code)|max\.?\s*marks|m\.?\s*marks|time|roll\s*no\.?\s*(?:\/\s*name)?|sem(?:ester)?)\s*[:;=|—-]/i)[0]?.replace(/[\s|_—]+$/g, "").trim();
  };
  const fields: DetectedFields = {};
  const labelledCollege = field("college(?: name)?|institute(?: name)?|institution(?: name)?");
  fields.collegeName = labelledCollege ?? lines.find((s) => /\b(college|institute|institution)\b/i.test(s) && !/\b(subject|university|affiliated|examination|exam code)\b/i.test(s))?.slice(0, 180);
  fields.university = field("university(?: name)?");
  fields.subjectName = field("subject(?:\\s*(?:name|title))?|course\\s*(?:name|title)|paper\\s*(?:name|title)");
  const labelledCode = field("subject\\s*code|paper\\s*code|course\\s*code|code")?.match(/[A-Z]{2,6}[ -]?\d{3,4}[A-Z]?/i)?.[0];
  const headingCode = [...header.matchAll(/\b[A-Z]{2,6}[ -]?\d{3,4}[A-Z]?\b/g)]
    .map((match) => match[0].replace(/[ -]/g, ""))
    .find((value) => !/^(SEM|ST|CT|PUT|YEAR|BTECH|MTECH|BCA|MCA|BBA|MBA|TIME|SET)\d/.test(value)
      && !/(?:199\d|20\d{2})[A-Z]?$/.test(value));
  const code = labelledCode ?? headingCode;
  if (code) fields.subjectCode = code.replace(/[ -]/g, "").toUpperCase();
  if (!fields.subjectName && fields.subjectCode) {
    const labelled = lines.find((s) => s.toUpperCase().includes(fields.subjectCode!) && /\s[:–—-]\s/.test(s));
    const candidate = labelled?.replace(new RegExp(`\\b${fields.subjectCode}\\b`, "i"), "").replace(/^\s*[:–—-]\s*|\s*[:–—-]\s*$/g, "").trim();
    if (candidate && !/code|semester|exam|college/i.test(candidate)) fields.subjectName = candidate;
  }
  // Many real papers print the title on its own line, next to a code rather
  // than a "Subject:" label. Use it only if one clean heading remains.
  if (!fields.subjectName && (fields.subjectCode || /\b(?:THEORY\s+EXAMINATION|semester|sem)\b/i.test(header))) {
    const titles = lines.filter((line) =>
      line.length >= 3 && line.length <= 120 && !/[0-9:=]/.test(line)
      && !/\b(college|institute|institution|university|affiliated|examination|semester|sem|session|year|branch|department|time|hours?|marks|duration|set|instructions?|note|roll|printed|paper id|section|question paper|end[ -]sem|mid[ -]sem|CT|ST|PUT|BCA|MCA|BBA|MBA|CSE|IT|ECE|EE|ME|CE|AIML|DS)\b/i.test(line)
      && !/\b[BM][.\s-]*Tech\b/i.test(line)
      && !Object.values(branchNames).some((name) => textKey(name) === textKey(line))
      && !/^[A-Z]{2,7}$/.test(line)
    );
    if (titles.length === 1) fields.subjectName = titles[0];
  }
  const sem = header.match(/\b(?:semester|sem)\s*[:;=-]?\s*(\d{1,2}|XII|XI|IX|VIII|VII|VI|IV|III|II|X|V|I)\b/i)?.[1]
    ?? header.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:semester|sem)\b/i)?.[1]
    ?? header.match(/\b(XII|XI|IX|VIII|VII|VI|IV|III|II|X|V|I)\s*semester\b/i)?.[1];
  const number = sem ? Number(sem) || romans[sem.toUpperCase()] : undefined;
  if (number && number <= 12) fields.semesterNumber = number;
  const program = header.match(/\bB[.\s-]*Tech\b|\bM[.\s-]*Tech\b|\bMBA\b|\bMCA\b|\bBBA\b|\bBCA\b/i)?.[0];
  if (program) fields.programName = textKey(program) === "btech" ? "B.Tech" : textKey(program) === "mtech" ? "M.Tech" : program.toUpperCase();
  const branch = field("branch(?:\\s*name|\\s*/\\s*section)?|department|discipline");
  const branchLines = header.split(/\r?\n/).filter((line) => !/college|institute|institution|university|(?:subject|paper|course)\s*(?:name|title|code)\s*[:;=|—-]|note\s*[:;]|roll\s*no|paper\s*id/i.test(line));
  const codesIn = (line: string) => Object.keys(branchNames).filter((code) => new RegExp(`\\b${code}\\b`).test(line));
  const branchRegion = branchLines.filter((line, i) => /[BM][. -]*TECH|branch|department|discipline/i.test(line)
    || (codesIn(line).length > 1 && /[,/]/.test(line))
    || (codesIn(line).length === 1 && textKey(line) === textKey(codesIn(line)[0]) && /[BM][. -]*TECH|branch/i.test(branchLines[i - 1] ?? ""))).join("\n");
  const knownBranches = Object.entries(branchNames).filter(([code, name]) => (branch && (textKey(branch).includes(textKey(name)) || new RegExp(`\\b${code}\\b`, "i").test(branch))) || new RegExp(`\\b${code}\\b`).test(branchRegion));
  if (knownBranches.length > 1) fields.branchCodes = knownBranches.map(([code]) => code);
  else if (knownBranches.length === 1) {
    fields.branchCode = knownBranches[0][0]; fields.branchName = knownBranches[0][1];
  } else if (branch && /[a-zA-Z]{4}/.test(branch) && !/[\d?]/.test(branch)) fields.branchName = branch;
  const exam = header.match(/\bend[ -]?(?:semester|sem)\b/i) ? "END_SEM"
    : header.match(/\bmid[ -]?(?:semester|sem)\b/i) ? "MID_SEM"
    : header.match(/\b(?:PUT|pre[ -]university test)\b/i) ? "PUT"
    : header.match(/\b(?:ST|sessional test)\b/i) ? "ST"
    : header.match(/\b(?:CT|class test)\b/i) ? "CT" : undefined;
  if (exam) fields.examCode = exam;
  let sessionStart: number | undefined;
  const session = header.match(/\b((?:20\d{2}|199\d))\s*[-–/]\s*(\d{2}|(?:20\d{2}|199\d))\b/);
  if (session) {
    const from = Number(session[1]);
    const to = session[2].length === 2 ? Math.floor(from / 100) * 100 + Number(session[2]) : Number(session[2]);
    if (to === from + 1 && from <= new Date().getFullYear() + 1) { fields.sessionLabel = `${from}-${session[2]}`; sessionStart = from; }
  }
  const testNumber = header.match(/\b(ST|CT|PUT)\s*[-:]?\s*([1-9])\b/i);
  if (testNumber) fields.sessionLabel = `${testNumber[1].toUpperCase()}-${testNumber[2]}${fields.sessionLabel ? ` · ${fields.sessionLabel}` : ""}`;
  const years = [...header.matchAll(/\b(20\d{2}|199\d)\b/g)].map((m) => Number(m[1]));
  const unique = [...new Set(years.filter((y) => y <= new Date().getFullYear() + 1))];
  if (unique.length === 1) fields.academicYear = unique[0];
  else if (sessionStart && unique.every(year => year === sessionStart || year === sessionStart + 1)) fields.academicYear = sessionStart;
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as DetectedFields;
}

/** File names are user hints, never evidence of college/branch or publication safety. */
export function filenameExamHint(name: string): string | undefined {
  const stem = name.replace(/\.(pdf|png|jpe?g)$/i, "");
  const match = stem.match(/(?:^|[ _-]|\d)(END(?:[ _-]?SEM)?|MID(?:[ _-]?SEM)?|PUT[ _-]?[1-9]?|ST[ _-]?[1-9]?|CT[ _-]?[1-9]?)$/i)?.[1]?.toUpperCase();
  if (!match) return undefined;
  return match.startsWith("END") ? "END_SEM" : match.startsWith("MID") ? "MID_SEM" : match.replace(/[ _-]?[1-9]$/, "");
}

/** One shared boundary rule for free-text and table-based headers. */
export function paperHeader(text: string): string {
  return text.split(/\b(?:(?<!\/)Section\s*[-=–—:]?\s*[A-F]\b|Instructions?\s*[:;]|Q\.?\s*1\b|1[.)]\s)/i)[0].slice(0, 3500);
}
