import { describe, expect, it } from "vitest";
import { collegeSearchSchema, searchSchema, registerSchema } from "@/server/validators";

describe("search input", () => {
  it("defaults to page 1 with an empty query", () => {
    expect(searchSchema.parse({})).toEqual({ q: "", page: 1 });
  });

  it("coerces page numbers and rejects nonsense", () => {
    expect(searchSchema.parse({ q: "dbms", page: "3" }).page).toBe(3);
    expect(searchSchema.safeParse({ q: "dbms", page: "0" }).success).toBe(false);
  });

  it("normalises college filters", () => {
    const parsed = collegeSearchSchema.parse({ q: " abes ", verifiedOnly: "true" });
    expect(parsed.q).toBe("abes");
    expect(parsed.verifiedOnly).toBe(true);
  });
});

describe("registration rules", () => {
  it("lowercases emails and requires a strong-enough password", () => {
    const parsed = registerSchema.parse({
      name: "Abbas Ansari",
      email: "ABBAS@Example.COM",
      password: "papervault123",
    });
    expect(parsed.email).toBe("abbas@example.com");
  });

  it("rejects short or letters-only passwords", () => {
    expect(registerSchema.safeParse({ name: "Ab", email: "a@b.com", password: "short1" }).success).toBe(false);
    expect(
      registerSchema.safeParse({ name: "Ab", email: "a@b.com", password: "onlylettershere" }).success,
    ).toBe(false);
  });
});
