import { branchNames, textKey } from "./paper-detection";

/** A grouping shorthand from a user-entered branch, not a guess from a paper. */
export function branchCodeFromName(name: string): string {
  const known = Object.entries(branchNames).find(([code, full]) => textKey(name) === textKey(code) || textKey(name) === textKey(full));
  if (known) return known[0];
  const words = name.trim().split(/[^a-zA-Z0-9]+/).filter((word) => word && !/^(and|of|the|in|for)$/i.test(word));
  const code = words.length > 1 ? words.map((word) => word[0]).join("") : words[0] ?? "";
  return code.toUpperCase().slice(0, 16);
}

/** Known code aliases may reuse a longer catalogue label; unrelated names may not. */
export function branchInputMatchesExisting(input: { branchName: string; branchCode: string }, existing: { name: string; code: string }): boolean {
  if (textKey(input.branchName) === textKey(existing.name)) return true;
  if (textKey(input.branchCode) !== textKey(existing.code)) return false;
  return textKey(input.branchName) === textKey(existing.code)
    || textKey(input.branchName) === textKey(branchNames[input.branchCode.toUpperCase()] ?? "");
}
