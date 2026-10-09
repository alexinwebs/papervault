import { logger } from "./logger";
import { configuredSiteUrl } from "./site";

const DEV_SECRET = "dev-only-secret-change-me-0123456789abcdef";

/**
 * Fails fast on configuration that is fine locally but dangerous in
 * production. Imported from instrumentation.ts so it runs once at boot.
 */
export function assertEnvironment() {
  const problems: string[] = [];
  const warnings: string[] = [];
  const prod = process.env.NODE_ENV === "production";

  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret || secret.length < 24) problems.push("AUTH_SECRET is missing or shorter than 24 characters.");
  if (prod && secret === DEV_SECRET) {
    problems.push("AUTH_SECRET is still the development default. Generate a new one.");
  }
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is not set.");

  if (prod) {
    const site = configuredSiteUrl();
    const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(site);
    // `npm start` on a laptop is a production build but not a deployment, so
    // only insist on TLS once the app is actually addressed by a real host.
    if (!local && !site.startsWith("https://")) {
      problems.push("NEXT_PUBLIC_SITE_URL must be an https:// URL in production.");
    }
    if (local) return;

    const db = process.env.DATABASE_URL ?? "";
    if (db && !/^postgres(ql)?:\/\//.test(db)) {
      problems.push("DATABASE_URL must be a postgresql:// connection string.");
    }

    const cron = process.env.CRON_SECRET ?? "";
    if (cron && cron.length < 32) problems.push("CRON_SECRET must be at least 32 characters (openssl rand -hex 32).");
    if (!cron) warnings.push("CRON_SECRET is not set: nightly purge and email retry will not run.");

    const driver = process.env.STORAGE_DRIVER ?? "local";
    if (driver === "s3") {
      if (!process.env.S3_BUCKET) problems.push("STORAGE_DRIVER=s3 but S3_BUCKET is not set.");
    } else {
      warnings.push(
        "STORAGE_DRIVER=local: uploads live on this machine's disk. Mount a persistent, backed-up " +
          "volume and run a single instance, or switch to s3.",
      );
    }

    if ((process.env.MALWARE_SCANNER ?? "none") !== "clamav") {
      if (process.env.ALLOW_UNSCANNED_UPLOADS === "true") {
        warnings.push("Malware scanning is OFF (ALLOW_UNSCANNED_UPLOADS=true).");
      } else {
        problems.push(
          "MALWARE_SCANNER must be 'clamav' for a public deployment " +
            "(or set ALLOW_UNSCANNED_UPLOADS=true to accept the risk explicitly).",
        );
      }
    }

    const mailer = (process.env.MAIL_DRIVER ?? "").toLowerCase();
    const hasTransport = Boolean(
      process.env.GMAIL_USER ||
        process.env.SMTP_HOST ||
        process.env.RESEND_API_KEY ||
        process.env.POSTMARK_SERVER_TOKEN,
    );
    if (mailer === "log" || !hasTransport) {
      if (process.env.REQUIRE_EMAIL_VERIFICATION !== "false") {
        problems.push(
          "No mail transport is configured, so nobody could verify their email or reset a password. " +
            "Set MAIL_DRIVER plus GMAIL_USER/GMAIL_APP_PASSWORD, SMTP_HOST, RESEND_API_KEY or POSTMARK_SERVER_TOKEN.",
        );
      } else {
        warnings.push("No mail transport configured: notification emails will not be delivered.");
      }
    }

    if (!process.env.REDIS_URL) {
      warnings.push("REDIS_URL is not set: rate limits are per-instance only. Fine for one instance.");
    }
    if (!process.env.CONTACT_EMAIL) {
      problems.push("CONTACT_EMAIL is not set: the legal pages and security.txt need a real contact address.");
    }
    if (mailer === "resend" && !process.env.RESEND_API_KEY) problems.push("MAIL_DRIVER=resend needs RESEND_API_KEY.");
    if (mailer === "postmark" && !process.env.POSTMARK_SERVER_TOKEN) {
      problems.push("MAIL_DRIVER=postmark needs POSTMARK_SERVER_TOKEN.");
    }
    if ((mailer === "resend" || mailer === "postmark") && !process.env.MAIL_FROM) {
      problems.push(`MAIL_DRIVER=${mailer} needs MAIL_FROM on a domain verified with the provider.`);
    }
    if (!process.env.ADMIN_EMAIL && !process.env.ADMIN_NOTIFY_EMAIL) {
      warnings.push("ADMIN_EMAIL is not set: admin alerts go only to platform admin accounts.");
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || "")) {
      problems.push("ADMIN_EMAIL is not a valid email address.");
    }
    if (!process.env.SENTRY_DSN) warnings.push("SENTRY_DSN is not set: server errors are only logged.");
    if (process.env.REQUIRE_ADMIN_2FA === "false") warnings.push("REQUIRE_ADMIN_2FA=false: admins can skip 2FA.");
  }

  for (const warning of warnings) logger.warn("env_warning", { warning });
  if (problems.length > 0) {
    throw new Error(`Refusing to start:\n  - ${problems.join("\n  - ")}`);
  }
}
