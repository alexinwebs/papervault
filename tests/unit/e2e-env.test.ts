import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));
vi.mock("node:fs", () => fs);
import { localEnv } from "../e2e/env";

const keys = ["DATABASE_URL", "REQUIRE_ADMIN_2FA", "CRON_SECRET", "LOGIN_ATTEMPTS_PER_MINUTE", "REGISTRATIONS_PER_IP_PER_HOUR"];

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of keys) vi.stubEnv(key, undefined);
  fs.existsSync.mockReturnValue(false);
});
afterEach(() => vi.unstubAllEnvs());

describe("browser-test environment", () => {
  it("uses an exported database URL in CI without a .env file", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/ci_test");
    expect(localEnv().DATABASE_URL).toBe("postgresql://test:test@localhost:5432/ci_test");
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it("prefers the exported database URL over a local file", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("DATABASE_URL=postgresql://test:test@localhost:5432/file_test");
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/exported_test");
    expect(localEnv().DATABASE_URL).toBe("postgresql://test:test@localhost:5432/exported_test");
  });

  it("retains file values when a variable is not exported", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('DATABASE_URL="postgresql://test:test@localhost:5432/local_test"\nCRON_SECRET=file-test-secret');
    expect(localEnv()).toMatchObject({
      DATABASE_URL: "postgresql://test:test@localhost:5432/local_test",
      CRON_SECRET: "file-test-secret",
    });
  });

  it("keeps the Node parser's last-value rule for duplicate file keys", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("LOGIN_ATTEMPTS_PER_MINUTE=1\nLOGIN_ATTEMPTS_PER_MINUTE=1000");
    expect(localEnv().LOGIN_ATTEMPTS_PER_MINUTE).toBe("1000");
  });

  it("retains the CI settings used by global setup", () => {
    vi.stubEnv("REQUIRE_ADMIN_2FA", "false");
    vi.stubEnv("CRON_SECRET", "ci-test-secret");
    vi.stubEnv("LOGIN_ATTEMPTS_PER_MINUTE", "1000");
    vi.stubEnv("REGISTRATIONS_PER_IP_PER_HOUR", "1000");
    expect(localEnv()).toMatchObject({
      REQUIRE_ADMIN_2FA: "false",
      CRON_SECRET: "ci-test-secret",
      LOGIN_ATTEMPTS_PER_MINUTE: "1000",
      REGISTRATIONS_PER_IP_PER_HOUR: "1000",
    });
  });
});