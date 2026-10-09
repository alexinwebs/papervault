import { describe, expect, it } from "vitest";
import { assertNotDuplicate, contentFingerprint, type DuplicateHit } from "@/server/services/papers";

const body = "Q1. Define normalization and explain third normal form with an example. ".repeat(5);

const hit = (over: Partial<DuplicateHit>): DuplicateHit => ({
  id: "p1",
  title: "Database Management Systems",
  status: "PUBLISHED",
  match: "FILE_HASH",
  binned: false,
  ...over,
});

describe("content fingerprint", () => {
  it("ignores case, punctuation and whitespace differences", () => {
    const a = contentFingerprint(body);
    const b = contentFingerprint(body.toUpperCase().replace(/ /g, "\n  "));
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("changes when the words change", () => {
    expect(contentFingerprint(body)).not.toBe(contentFingerprint(`${body} extra question here.`));
  });

  it("refuses to fingerprint too little text", () => {
    // A photographed paper has no text layer; fingerprinting a few stray
    // characters would make every photo collide with every other photo.
    expect(contentFingerprint("Q1.")).toBeNull();
    expect(contentFingerprint("")).toBeNull();
    expect(contentFingerprint(null)).toBeNull();
    expect(contentFingerprint(undefined)).toBeNull();
  });
});

describe("duplicate refusal", () => {
  it("lets a clean upload through", () => {
    expect(() => assertNotDuplicate([])).not.toThrow();
  });

  it("names the paper an identical file collided with", () => {
    expect(() => assertNotDuplicate([hit({})])).toThrow(/already in the archive as "Database Management Systems"/);
  });

  it("explains a same-pages, different-file match", () => {
    expect(() => assertNotDuplicate([hit({ match: "CONTENT" })])).toThrow(
      /pages are identical, even though the file is not/,
    );
  });

  it("tells the contributor how to file a genuinely different set", () => {
    expect(() => assertNotDuplicate([hit({ match: "SLOT" })])).toThrow(/upload it as Set B or Set C/);
  });

  it("says when the collision is sitting in the recycle bin", () => {
    // Otherwise "bin it and upload again" would look like a silent no-op.
    expect(() => assertNotDuplicate([hit({ binned: true })])).toThrow(/currently in the recycle bin/);
  });

  it("reports the strongest match first", () => {
    expect(() =>
      assertNotDuplicate([hit({ match: "FILE_HASH" }), hit({ id: "p2", match: "SLOT" })]),
    ).toThrow(/exact file/);
  });
});
