import { execSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";
import { localEnv } from "./env";

/**
 * Fails fast (instead of 40 minutes of timeouts) when .env is missing the
 * local-testing settings, then brings the schema up to date and re-seeds, so
 * journey tests always start from the same known archive.
 */
export default async function globalSetup(config: FullConfig) {
  const env = localEnv();
  const problems: string[] = [];
  if (env.REQUIRE_ADMIN_2FA !== "false")
    problems.push('REQUIRE_ADMIN_2FA=false   (npm start runs in production mode, which forces admins through 2FA)');
  if (!env.CRON_SECRET) problems.push('CRON_SECRET="local-cron-secret"   (any value works; the maintenance test needs one)');
  if (Number(env.LOGIN_ATTEMPTS_PER_MINUTE || 0) < 100)
    problems.push("LOGIN_ATTEMPTS_PER_MINUTE=1000   (the suite signs in far more often than a person would)");
  if (Number(env.REGISTRATIONS_PER_IP_PER_HOUR || 0) < 100)
    problems.push("REGISTRATIONS_PER_IP_PER_HOUR=1000   (the suite creates many accounts from one IP)");

  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  if (problems.length === 0) {
    // The file is right; make sure the running server was started with it.
    const probe = await fetch(`${baseURL}/api/cron/purge`, { method: "POST" }).catch(() => null);
    if (probe?.status === 503)
      problems.push("The running server has no CRON_SECRET: it was started before .env was edited. Stop it (Ctrl+C) and run npm start again.");
  }
  if (problems.length > 0) {
    throw new Error(
      "\n\nThe browser tests need these settings in .env (each key once; a later duplicate line overrides an earlier one):\n  " +
        problems.join("\n  ") +
        "\n\nFix .env, restart the server (Ctrl+C, then npm start), and run the tests again.\n",
    );
  }

  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}
