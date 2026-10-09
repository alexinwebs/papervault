import { describe, expect, it } from "vitest";
import { PAPER_TRANSITIONS, type PaperStatus } from "@/lib/constants";
import { assertTransition } from "@/server/services/papers";

describe("paper lifecycle", () => {
  it("allows the happy path submitted -> pending -> approved -> published", () => {
    expect(() => assertTransition("DRAFT", "SUBMITTED")).not.toThrow();
    expect(() => assertTransition("SUBMITTED", "PENDING_REVIEW")).not.toThrow();
    expect(() => assertTransition("PENDING_REVIEW", "APPROVED")).not.toThrow();
    expect(() => assertTransition("APPROVED", "PUBLISHED")).not.toThrow();
  });

  it("never publishes straight from a student submission", () => {
    expect(() => assertTransition("SUBMITTED", "PUBLISHED")).toThrow(/cannot move/i);
    expect(() => assertTransition("DRAFT", "PUBLISHED")).toThrow();
  });

  it("treats removed and merged as terminal", () => {
    expect(PAPER_TRANSITIONS.REMOVED).toEqual([]);
    expect(PAPER_TRANSITIONS.MERGED).toEqual([]);
    expect(() => assertTransition("REMOVED", "PUBLISHED")).toThrow();
  });

  it("can restrict a published paper and send it back to review", () => {
    expect(() => assertTransition("PUBLISHED", "RESTRICTED")).not.toThrow();
    expect(() => assertTransition("RESTRICTED", "PENDING_REVIEW")).not.toThrow();
  });

  it("declares transitions for every status", () => {
    for (const status of Object.keys(PAPER_TRANSITIONS) as PaperStatus[]) {
      expect(Array.isArray(PAPER_TRANSITIONS[status])).toBe(true);
    }
  });
});
