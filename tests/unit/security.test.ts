import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  isSameOrigin,
  requiresOriginCheck,
  type OriginContext,
} from "@/lib/security";
import { verifyPassword } from "@/lib/password";

const base: OriginContext = {
  origin: null,
  secFetchSite: null,
  host: "papervault.example",
  forwardedHost: null,
  forwardedProto: null,
  protocol: "https",
  requestOrigin: "https://papervault.example",
  siteUrl: "https://papervault.example",
};

describe("origin checks", () => {
  it("only guards methods that can change state", () => {
    expect(requiresOriginCheck("GET", "/login")).toBe(false);
    expect(requiresOriginCheck("HEAD", "/login")).toBe(false);
    expect(requiresOriginCheck("POST", "/login")).toBe(true);
    expect(requiresOriginCheck("patch", "/settings")).toBe(true);
    expect(requiresOriginCheck("DELETE", "/admin/colleges")).toBe(true);
  });

  it("exempts the header-authenticated cron route", () => {
    expect(requiresOriginCheck("POST", "/api/cron/purge")).toBe(false);
    // Only that prefix: a lookalike must still be checked.
    expect(requiresOriginCheck("POST", "/api/cronjob")).toBe(true);
  });

  it("trusts a same-origin fetch metadata header", () => {
    expect(isSameOrigin({ ...base, secFetchSite: "same-origin" })).toBe(true);
  });

  it("rejects a cross-site fetch even when it claims our origin header", () => {
    expect(isSameOrigin({ ...base, secFetchSite: "cross-site", origin: "https://evil.example" })).toBe(
      false,
    );
  });

  it("accepts the configured site origin for browsers without fetch metadata", () => {
    expect(isSameOrigin({ ...base, origin: "https://papervault.example" })).toBe(true);
  });

  it("accepts the forwarded host a reverse proxy reports", () => {
    expect(
      isSameOrigin({
        ...base,
        siteUrl: null,
        origin: "https://papers.college.edu",
        forwardedHost: "papers.college.edu",
        forwardedProto: "https",
      }),
    ).toBe(true);
  });

  it("refuses a request that carries no origin evidence at all", () => {
    expect(isSameOrigin(base)).toBe(false);
  });

  it("is not fooled by a subdomain of our host", () => {
    expect(isSameOrigin({ ...base, origin: "https://evil.papervault.example" })).toBe(false);
  });

  it("ignores a malformed configured site URL instead of crashing", () => {
    expect(() => isSameOrigin({ ...base, siteUrl: "not a url", origin: "https://x.example" })).not.toThrow();
  });
});

describe("content security policy", () => {
  it("carries the nonce and never allows inline script", () => {
    const csp = contentSecurityPolicy("abc123");
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp.split("script-src")[1].split(";")[0]).not.toContain("unsafe-inline");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval and websockets only in development", () => {
    expect(contentSecurityPolicy("n", { dev: true })).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy("n", { dev: true })).toContain("ws: wss:");
    expect(contentSecurityPolicy("n", { dev: false })).not.toContain("'unsafe-eval'");
  });

  it("pins the directives an attacker would otherwise use to pivot", () => {
    const csp = contentSecurityPolicy("n");
    for (const directive of ["base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"]) {
      expect(csp).toContain(directive);
    }
  });
});

describe("password verification", () => {
  it("treats an unusable placeholder hash as never matching", async () => {
    // What an erased account is left with: no password can ever match it.
    await expect(verifyPassword("papervault123", "erased:deadbeef")).resolves.toBe(false);
    await expect(verifyPassword("", "")).resolves.toBe(false);
  });

  it("still verifies a real hash", async () => {
    const { hashPassword } = await import("@/lib/password");
    const hash = await hashPassword("correct horse");
    await expect(verifyPassword("correct horse", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong horse", hash)).resolves.toBe(false);
  });
});
