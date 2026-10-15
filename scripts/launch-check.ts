/** Read-only launch checks. No seeding, deletion, mutation or secret-value output. */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
const db = new PrismaClient();
let blockers = 0;
function check(ok: boolean, message: string) {
  console.log(`${ok ? "PASS" : "BLOCK"} ${message}`);
  if (!ok) blockers++;
}
async function main() {
  console.log("PaperVault launch check — read only; not a security certification\n");
  const [demoAccounts, publicDemoPapers, publicPapers, admins] = await Promise.all([
    db.user.count({ where: { email: { endsWith: "@papervault.dev" } } }),
    db.paper.count({ where: { status: "PUBLISHED", restricted: false, deletedAt: null, uploadedBy: { email: { endsWith: "@papervault.dev" } } } }),
    db.paper.count({ where: { status: "PUBLISHED", restricted: false, deletedAt: null } }),
    db.user.count({ where: { role: "PLATFORM_ADMIN", status: "ACTIVE", NOT: { email: { endsWith: "@papervault.dev" } } } }),
  ]);
  check(demoAccounts === 0, `Demo-domain accounts: ${demoAccounts}. Review purge-demo dry run if present.`);
  check(publicDemoPapers === 0, `Published demo-domain papers: ${publicDemoPapers}. Never advertise fixtures as real coverage.`);
  check(admins > 0, `Active non-demo platform administrators: ${admins}.`);
  console.log(`INFO Published unrestricted papers: ${publicPapers}; this does not establish content rights or quality.`);
  for (const key of ["CONTACT_EMAIL", "OPERATOR_NAME", "GRIEVANCE_OFFICER_EMAIL", "SECURITY_CONTACT_EMAIL", "MAIL_FROM"]) {
    const value = process.env[key]?.trim() ?? "";
    check(Boolean(value) && !/@(?:example\.(?:com|test)|invalid)$|\.(?:invalid|test)$|replace|change[-_ ]?me/i.test(value), `${key} is configured with a non-placeholder value (value hidden).`);
  }
  check(Boolean(process.env.AUTH_SECRET) && process.env.AUTH_SECRET!.length >= 32 && !/(?:dev-|replace|change[-_ ]?me|ci-only)/i.test(process.env.AUTH_SECRET!), "AUTH_SECRET is at least 32 characters and not the development prefix (value hidden).");
  check(Boolean(process.env.CRON_SECRET) && process.env.CRON_SECRET!.length >= 32 && !/(?:replace|change[-_ ]?me|local-cron|ci-only)/i.test(process.env.CRON_SECRET!), "CRON_SECRET is at least 32 characters (value hidden).");
  check(process.env.REQUIRE_EMAIL_VERIFICATION !== "false", "Email verification is not disabled.");
  check(process.env.REQUIRE_ADMIN_2FA !== "false", "Administrator 2FA is not disabled.");
  check(process.env.MALWARE_SCANNER === "clamav", "ClamAV is configured; verify actual readiness at /api/healthz.");
  check(Boolean(process.env.MAIL_DRIVER) && process.env.MAIL_DRIVER !== "log", "A delivery mail driver is selected; send a real test email to verify delivery.");
  const origin = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  let https = false;
  try { const url = new URL(origin); https = url.protocol === "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); } catch { /* invalid origin fails below */ }
  check(https, "A public HTTPS site origin is configured.");
  console.log("\nMANUAL Confirm document permissions, session labels, actual scan/download behavior, moderation coverage, private storage, off-server backups and a successful isolated restore.");
  console.log("MANUAL Database counts cannot detect every synthetic document, fake metric or invalid policy contact. Inspect representative content and policies yourself.");
  console.log(`\n${blockers ? `${blockers} blocker(s): review before promoting the site.` : "Automatic checks passed; complete the manual launch checklist before promotion."}`);
  process.exitCode = blockers ? 1 : 0;
}
main().catch(() => { console.error("Launch check could not complete. Check database configuration/connectivity; no records were changed."); process.exitCode = 1; }).finally(() => db.$disconnect());
