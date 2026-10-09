import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/**
 * The server reads .env with `node --env-file`, where a later duplicate line
 * wins. parseEnv uses the same parser, so this sees what the server sees
 * (unless the server was started before .env was last edited).
 */
export function localEnv(): Record<string, string | undefined> {
  const file = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
  return { ...file, ...pick(process.env) };
}

function pick(env: NodeJS.ProcessEnv) {
  const keys = ["REQUIRE_ADMIN_2FA", "CRON_SECRET", "LOGIN_ATTEMPTS_PER_MINUTE", "REGISTRATIONS_PER_IP_PER_HOUR"];
  return Object.fromEntries(keys.filter((k) => env[k] !== undefined).map((k) => [k, env[k]]));
}
