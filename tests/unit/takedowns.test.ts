import { describe, expect, it } from "vitest";
import { paperIdFromUrl } from "@/server/services/takedowns";
import { takedownSchema } from "@/server/validators";

describe("paperIdFromUrl", () => {
  it("pulls the id out of a full paper URL", () => {
    expect(paperIdFromUrl("https://papervault.dev/papers/cml9k2x0000abcd1234?utm=1")).toBe(
      "cml9k2x0000abcd1234",
    );
  });

  it("handles a path-only reference", () => {
    expect(paperIdFromUrl("/papers/cml9k2x0000abcd1234")).toBe("cml9k2x0000abcd1234");
  });

  it("returns null when the URL points somewhere else", () => {
    expect(paperIdFromUrl("https://papervault.dev/colleges/rkgit")).toBeNull();
    expect(paperIdFromUrl("not a url at all")).toBeNull();
  });
});

describe("takedownSchema", () => {
  const valid = {
    paperUrl: "https://papervault.dev/papers/cml9k2x0000abcd1234",
    claimantName: "R. Sharma",
    claimantEmail: "Registrar@College.EDU",
    claimantRole: "RIGHTS_HOLDER",
    reason: "This paper is a current internal assessment and was never released to students.",
    statementSigned: "on",
  };

  it("accepts a complete notice and normalises the email", () => {
    const parsed = takedownSchema.parse(valid);
    expect(parsed.claimantEmail).toBe("registrar@college.edu");
  });

  it("requires a substantive reason", () => {
    const result = takedownSchema.safeParse({ ...valid, reason: "take it down" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown capacity", () => {
    const result = takedownSchema.safeParse({ ...valid, claimantRole: "CURIOUS_BYSTANDER" });
    expect(result.success).toBe(false);
  });
});
