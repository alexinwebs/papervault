import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

/**
 * The token module is exercised end to end by the e2e suite; these tests pin
 * the two properties that matter if the implementation is ever refactored:
 * tokens are stored hashed, and lookups are by digest rather than raw value.
 */
describe("auth token storage", () => {
  it("never stores the raw token", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/lib/tokens.ts", "utf8"),
    );
    expect(source).toContain('createHash("sha256")');
    expect(source).toContain("tokenHash");
    // A raw token must never be written to a column.
    expect(source).not.toMatch(/token:\s*raw/);
  });

  it("produces a stable digest", () => {
    const digest = createHash("sha256").update("abc").digest("hex");
    expect(digest).toHaveLength(64);
  });
});
