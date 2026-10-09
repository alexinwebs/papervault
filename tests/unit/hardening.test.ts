import { afterEach, describe, expect, it } from "vitest";
import { clientIpFrom, trustedProxyHops } from "@/lib/client-ip";
import { safeLocalPath } from "@/lib/utils";
import { AppError, toPublicError } from "@/lib/errors";
import { needsSecondFactor } from "@/lib/two-factor-policy";
import {
  assertCanModerate,
  assertCollegeScope,
  assertPlatformAdmin,
  canViewPaperFile,
} from "@/server/authz";
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

describe("client IP behind a proxy", () => {
  it("takes the entry our proxy appended, not the one the client sent", () => {
    // Client forged "6.6.6.6"; Caddy appended the real peer.
    expect(clientIpFrom("6.6.6.6, 203.0.113.7", null, 1)).toBe("203.0.113.7");
    expect(clientIpFrom("6.6.6.6, 203.0.113.7, 10.0.0.2", null, 2)).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP only when the chain is too short", () => {
    expect(clientIpFrom(null, "198.51.100.4", 1)).toBe("198.51.100.4");
    expect(clientIpFrom("203.0.113.7", "198.51.100.4", 2)).toBe("198.51.100.4");
  });

  it("ignores forwarding headers entirely with zero trusted hops", () => {
    expect(clientIpFrom("203.0.113.7", "198.51.100.4", 0)).toBeNull();
  });

  it("rejects values that are not IP-shaped (header injection, junk)", () => {
    expect(clientIpFrom("evil<script>", null, 1)).toBeNull();
    expect(clientIpFrom("::1", null, 1)).toBe("::1");
  });

  it("reads TRUSTED_PROXY_HOPS with a safe default", () => {
    expect(trustedProxyHops({})).toBe(1);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "0" })).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "2" })).toBe(2);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "banana" })).toBe(1);
  });
});

describe("post-login redirect targets", () => {
  it("keeps local paths", () => {
    expect(safeLocalPath("/papers/abc?x=1#c")).toBe("/papers/abc?x=1#c");
  });
  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "", "/\t/evil.example"])(
    "refuses %j",
    (value) => {
      expect(safeLocalPath(value)).toBe("/");
    },
  );
});

describe("public error mapping", () => {
  it("passes AppErrors through with their HTTP status", () => {
    expect(toPublicError(new AppError("RATE_LIMITED", "Slow down."))).toEqual({
      code: "RATE_LIMITED",
      message: "Slow down.",
      status: 429,
    });
  });
  it("turns Prisma unique clashes and missing rows into user-facing errors", () => {
    const p2002 = Object.assign(new Error("x"), { name: "PrismaClientKnownRequestError", code: "P2002" });
    const p2025 = Object.assign(new Error("x"), { name: "PrismaClientKnownRequestError", code: "P2025" });
    expect(toPublicError(p2002).status).toBe(409);
    expect(toPublicError(p2025).status).toBe(404);
  });
  it("never leaks internal messages", () => {
    const pub = toPublicError(new Error("connection string postgres://secret"));
    expect(pub.status).toBe(500);
    expect(pub.message).not.toContain("postgres");
  });
});

describe("server-side admin 2FA", () => {
  const original = process.env.REQUIRE_ADMIN_2FA;
  afterEach(() => {
    process.env.REQUIRE_ADMIN_2FA = original;
  });

  it("blocks admin roles without 2FA from every privileged helper when enforced", () => {
    process.env.REQUIRE_ADMIN_2FA = "true";
    const admin = user({ role: "PLATFORM_ADMIN" });
    const collegeAdmin = user({ role: "COLLEGE_ADMIN", collegeId: "c1" });
    expect(() => assertPlatformAdmin(admin)).toThrow(/two-factor/);
    expect(() => assertCanModerate(collegeAdmin)).toThrow(/two-factor/);
    expect(() => assertCollegeScope(collegeAdmin, "c1")).toThrow(/two-factor/);
    expect(
      canViewPaperFile(
        { status: "PENDING_REVIEW", restricted: false, uploadedById: "x", collegeId: "c1" },
        collegeAdmin,
      ),
    ).toBe(false);
  });

  it("lets enrolled admins through", () => {
    process.env.REQUIRE_ADMIN_2FA = "true";
    const admin = user({ role: "PLATFORM_ADMIN", totpConfirmedAt: new Date() });
    expect(() => assertPlatformAdmin(admin)).not.toThrow();
    expect(() => assertCollegeScope(admin, "any")).not.toThrow();
  });

  it("does not demand 2FA from moderators, and respects the off switch", () => {
    process.env.REQUIRE_ADMIN_2FA = "true";
    expect(() => assertCanModerate(user({ role: "MODERATOR", collegeId: "c1" }))).not.toThrow();
    process.env.REQUIRE_ADMIN_2FA = "false";
    expect(needsSecondFactor(user({ role: "PLATFORM_ADMIN" }))).toBe(false);
  });

  it("still rejects students and cross-college moderators", () => {
    process.env.REQUIRE_ADMIN_2FA = "false";
    expect(() => assertPlatformAdmin(user({ role: "COLLEGE_ADMIN", collegeId: "c1" }))).toThrow(
      /Platform admin/,
    );
    expect(() => assertCollegeScope(user({ role: "MODERATOR", collegeId: "c1" }), "c2")).toThrow(
      /own college/,
    );
    expect(() => assertCanModerate(user({}))).toThrow(/Moderator/);
  });
});
