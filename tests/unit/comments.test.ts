import { describe, expect, it } from "vitest";
import { publicBody } from "@/server/services/comments";
import { commentInputSchema, commentReportSchema } from "@/server/validators";

describe("comment validation", () => {
  it("rejects an empty body", () => {
    const result = commentInputSchema.safeParse({ paperId: "p1", body: " " });
    expect(result.success).toBe(false);
  });

  it("trims and accepts a normal comment", () => {
    const result = commentInputSchema.parse({ paperId: "p1", body: "  Is Q3 in syllabus?  " });
    expect(result.body).toBe("Is Q3 in syllabus?");
  });

  it("caps very long comments", () => {
    const result = commentInputSchema.safeParse({ paperId: "p1", body: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("only accepts known report reasons", () => {
    expect(commentReportSchema.safeParse({ commentId: "c1", reason: "SPAM" }).success).toBe(true);
    expect(commentReportSchema.safeParse({ commentId: "c1", reason: "NOPE" }).success).toBe(false);
  });
});

describe("removed comments", () => {
  it("keeps the body for published comments", () => {
    expect(publicBody({ status: "PUBLISHED", body: "hello" })).toBe("hello");
  });

  it("hides the body once removed and explains why", () => {
    expect(publicBody({ status: "REMOVED", body: "abuse", removedReason: "Off topic" })).toMatch(
      /removed by a moderator: Off topic/,
    );
    expect(publicBody({ status: "REMOVED", body: "abuse" })).not.toContain("abuse");
  });
});
