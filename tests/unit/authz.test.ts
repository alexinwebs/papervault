import { describe, expect, it } from "vitest";
import { assertCollegeScope, canViewPaperFile } from "@/server/authz";
import type { SessionUser } from "@/lib/auth";

const user = (overrides: Partial<SessionUser>): SessionUser => ({
  id: "u1",
  email: "a@b.dev",
  name: "Test",
  role: "STUDENT",
  collegeId: null,
  trustLevel: "NEW",
  emailVerifiedAt: new Date(),
  totpConfirmedAt: null,
  status: "ACTIVE",
  sessionId: "s1",
  ...overrides,
});

const paper = (overrides: Partial<Parameters<typeof canViewPaperFile>[0]> = {}) => ({
  status: "PUBLISHED",
  restricted: false,
  uploadedById: "uploader",
  collegeId: "collegeA",
  ...overrides,
});

describe("paper visibility", () => {
  it("lets anonymous visitors read published, unrestricted papers", () => {
    expect(canViewPaperFile(paper(), null)).toBe(true);
  });

  it("hides restricted papers from anonymous visitors and other students", () => {
    expect(canViewPaperFile(paper({ restricted: true }), null)).toBe(false);
    expect(canViewPaperFile(paper({ restricted: true }), user({ id: "someone" }))).toBe(false);
  });

  it("hides unpublished papers from other students", () => {
    expect(canViewPaperFile(paper({ status: "PENDING_REVIEW" }), user({ id: "someone" }))).toBe(false);
  });

  it("always lets the uploader see their own submission", () => {
    expect(
      canViewPaperFile(paper({ status: "PENDING_REVIEW" }), user({ id: "uploader" })),
    ).toBe(true);
  });

  it("lets a moderator of the same college see restricted papers", () => {
    expect(
      canViewPaperFile(
        paper({ restricted: true }),
        user({ role: "MODERATOR", collegeId: "collegeA" }),
      ),
    ).toBe(true);
  });

  it("does not let a moderator from another college see restricted papers", () => {
    expect(
      canViewPaperFile(
        paper({ restricted: true }),
        user({ role: "MODERATOR", collegeId: "collegeB" }),
      ),
    ).toBe(false);
  });

  it("gives platform admins global read access", () => {
    expect(
      canViewPaperFile(paper({ restricted: true }), user({ role: "PLATFORM_ADMIN" })),
    ).toBe(true);
  });
});

describe("tenant scope", () => {
  it("blocks a moderator from acting on another college", () => {
    expect(() =>
      assertCollegeScope(user({ role: "MODERATOR", collegeId: "collegeB" }), "collegeA"),
    ).toThrow(/your own college/i);
  });

  it("allows a moderator inside their own college", () => {
    expect(() =>
      assertCollegeScope(user({ role: "MODERATOR", collegeId: "collegeA" }), "collegeA"),
    ).not.toThrow();
  });

  it("blocks students entirely", () => {
    expect(() => assertCollegeScope(user({}), "collegeA")).toThrow(/moderator access/i);
  });

  it("allows platform admins anywhere", () => {
    expect(() => assertCollegeScope(user({ role: "PLATFORM_ADMIN" }), "anything")).not.toThrow();
  });
});
