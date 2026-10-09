import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEnvironment } from "@/lib/env";

const GOOD = {
  NODE_ENV: "production",
  AUTH_SECRET: "x".repeat(48),
  DATABASE_URL: "postgresql://u:p@db:5432/papervault",
  NEXT_PUBLIC_SITE_URL: "https://papers.example.org",
  CRON_SECRET: "c".repeat(64),
  STORAGE_DRIVER: "s3",
  S3_BUCKET: "papers",
  MALWARE_SCANNER: "clamav",
  MAIL_DRIVER: "smtp",
  SMTP_HOST: "smtp.example.org",
  CONTACT_EMAIL: "hello@example.org",
};

function withEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries({ ...GOOD, ...overrides })) {
    if (value === undefined) vi.stubEnv(key, undefined as unknown as string);
    else vi.stubEnv(key, value);
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("production environment contract", () => {
  it("accepts a complete production configuration", () => {
    withEnv({});
    expect(() => assertEnvironment()).not.toThrow();
  });

  it.each([
    [{ DATABASE_URL: "file:./dev.db" }, /postgresql/],
    [{ AUTH_SECRET: "dev-only-secret-change-me-0123456789abcdef" }, /development default/],
    [{ NEXT_PUBLIC_SITE_URL: "http://papers.example.org" }, /https/],
    [{ CRON_SECRET: "short" }, /CRON_SECRET/],
    [{ MALWARE_SCANNER: "none" }, /MALWARE_SCANNER/],
    [{ SMTP_HOST: undefined, MAIL_DRIVER: "log" }, /mail transport/],
    [{ S3_BUCKET: undefined }, /S3_BUCKET/],
    [{ CONTACT_EMAIL: undefined }, /CONTACT_EMAIL/],
  ])("refuses %o", (overrides, message) => {
    withEnv(overrides);
    expect(() => assertEnvironment()).toThrow(message);
  });

  it("allows deliberate, explicit downgrades", () => {
    withEnv({ MALWARE_SCANNER: "none", ALLOW_UNSCANNED_UPLOADS: "true", STORAGE_DRIVER: "local" });
    expect(() => assertEnvironment()).not.toThrow();
  });

  it("does not demand production services for a local `npm start`", () => {
    withEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000", MALWARE_SCANNER: "none", DATABASE_URL: "file:x" });
    expect(() => assertEnvironment()).not.toThrow();
  });
});
