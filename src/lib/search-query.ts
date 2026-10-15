/** Small, explicit aliases—not fuzzy guesses across unrelated subjects. */
const SUBJECT_ALIASES: Record<string, string> = {
  daa: "Design and Analysis of Algorithms",
  dbms: "Database Management Systems",
  oop: "Object Oriented Programming",
};
export function parsePaperSearch(raw: string) {
  const normalized = raw.trim().slice(0, 200)
    .replace(/\bend[\s-]*sem(?:ester)?\b/gi, "END_SEM")
    .replace(/\bmid[\s-]*sem(?:ester)?\b/gi, "MID_SEM")
    .replace(/\b([a-z]{2,5})\s*-?\s*(\d{3})\b/gi, "$1$2");
  const tokens = [...new Set(normalized.split(/[\s,·/]+/).map(t => t.trim()).filter(t => t.length > 1))].slice(0, 8);
  const years = tokens.filter(t => /^\d{4}(?:-\d{2,4})?$/.test(t)).map(t => Number(t.slice(0, 4))).filter(n => n >= 1990 && n <= 2100);
  const words = tokens.filter(t => !/^\d{4}(?:-\d{2,4})?$/.test(t));
  return { tokens, words, years };
}
export function subjectSearchTerms(token: string) {
  const expanded = SUBJECT_ALIASES[token.toLowerCase()];
  const code = /^([a-z]{2,5})(\d{3})$/i.exec(token);
  return [...new Set([token, ...(expanded ? [expanded] : []), ...(code ? [`${code[1]}-${code[2]}`] : [])])];
}
