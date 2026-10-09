import type { Metadata } from "next";
import { donationConfig, teacherVerificationEnabled } from "@/lib/features";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { driver as mailDriver, mailConfigured, mailFrom } from "@/lib/mailer";
import { adminMailbox } from "@/server/services/notifications";
import { documentRetentionDays, reapplyCooldownDays } from "@/server/services/teacher-verification";
import { MAX_UPLOAD_BYTES, TEACHER_DOC_MAX_BYTES, TICKET_ATTACHMENT_MAX_BYTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Settings · Admin", robots: { index: false } };

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

/**
 * Read-only on purpose: configuration lives in the environment so it is
 * versioned with the deployment, not editable by anyone holding a session.
 * Secrets are never shown, only whether they are set.
 */
export default async function AdminSettingsPage() {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/settings");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;
  const set = (v: string | undefined) => (v ? "set" : "not set");
  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: "Email",
      rows: [
        ["Driver (MAIL_DRIVER)", `${mailDriver()}${mailConfigured() ? "" : " — not delivering"}`],
        ["From (MAIL_FROM)", mailFrom()],
        ["Admin alerts (ADMIN_EMAIL)", adminMailbox() ?? "not set"],
        ["Contact (CONTACT_EMAIL)", process.env.CONTACT_EMAIL || "not set"],
      ],
    },
    {
      title: "Files",
      rows: [
        ["Storage (STORAGE_DRIVER)", process.env.STORAGE_DRIVER || "local"],
        ["S3 signed URLs", process.env.S3_SIGNED_URLS === "true" ? "on" : "off"],
        ["Malware scanner (MALWARE_SCANNER)", process.env.MALWARE_SCANNER || "none"],
        ["Paper upload limit", mb(MAX_UPLOAD_BYTES)],
        ["Teacher document limit", mb(TEACHER_DOC_MAX_BYTES)],
        ["Ticket attachment limit", mb(TICKET_ATTACHMENT_MAX_BYTES)],
      ],
    },
    {
      title: "Teacher verification",
      rows: [
        ["New applications (TEACHER_VERIFICATION_ENABLED)", teacherVerificationEnabled() ? "open" : "closed — page shows \"not open yet\""],
        ["Document retention after decision (TEACHER_DOC_RETENTION_DAYS)", `${documentRetentionDays()} days`],
        ["Re-apply cooldown after rejection (TEACHER_REAPPLY_COOLDOWN_DAYS)", `${reapplyCooldownDays()} days`],
      ],
    },
    {
      title: "Buy me a coffee",
      rows: [
        ["UPI ID (DONATION_UPI_ID)", donationConfig()?.upiId ?? "off — page and links hidden"],
        ["Payee name (DONATION_PAYEE_NAME)", donationConfig()?.payeeName ?? "—"],
      ],
    },
    {
      title: "Security",
      rows: [
        ["Admin 2FA (REQUIRE_ADMIN_2FA)", process.env.REQUIRE_ADMIN_2FA === "false" ? "off" : "on in production"],
        ["Email verification (REQUIRE_EMAIL_VERIFICATION)", process.env.REQUIRE_EMAIL_VERIFICATION === "false" ? "off" : "on"],
        ["Shared rate limits (REDIS_URL)", set(process.env.REDIS_URL)],
        ["Nightly maintenance (CRON_SECRET)", set(process.env.CRON_SECRET)],
        ["Error reporting (SENTRY_DSN)", set(process.env.SENTRY_DSN)],
      ],
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Settings"
        description="The live configuration, read from the server environment. Change values in .env and restart; secrets are never displayed."
      />
      {groups.map((g) => (
        <section key={g.title}>
          <SectionHeader title={g.title} />
          <Panel className="px-4 py-4">
            <dl className="grid gap-2 sm:grid-cols-2">
              {g.rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/60">{k}</dt>
                  <dd className="font-sans text-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </section>
      ))}
    </div>
  );
}
