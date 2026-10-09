import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, EmptyState, PageHeading, Panel } from "@/components/ui";
import { recentNotifications } from "@/server/services/notifications";
import { mailConfigured } from "@/lib/mailer";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications · Admin", robots: { index: false } };

const TONE: Record<string, "mint" | "pink" | "yellow" | "cream"> = {
  SENT: "mint",
  FAILED: "pink",
  QUEUED: "yellow",
  SKIPPED: "cream",
};

export default async function AdminNotificationsPage() {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/notifications");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const [notifications, configured] = [await recentNotifications(80), mailConfigured()];

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Email outbox"
        description="Every approval request and decision notice the platform generated, newest first."
      />

      <Panel className={configured ? "bg-mint px-4 py-3" : "bg-yellow px-4 py-3"}>
        <p className="font-mono text-xs">
          {configured
            ? "Gmail/SMTP delivery is configured. Messages below were actually sent."
            : "No mail transport configured — messages are recorded here but not delivered."}
        </p>
        {configured ? null : (
          <p className="mt-2 font-sans text-[11px] text-ink/70">
            Set <code>GMAIL_USER</code> and <code>GMAIL_APP_PASSWORD</code> in <code>.env</code> (create
            an App Password at myaccount.google.com/apppasswords with 2-Step Verification on), then
            restart the server.
          </p>
        )}
      </Panel>

      {notifications.length === 0 ? (
        <EmptyState title="Nothing sent yet" body="Upload a paper to trigger an approval request." />
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <li key={notification.id} className="pv-panel-flat flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-sm">{notification.subject}</span>
                <Chip accent={TONE[notification.status] ?? "cream"}>
                  {notification.status.toLowerCase()}
                </Chip>
              </div>
              <p className="break-all font-sans text-[11px] text-ink/60">
                {notification.type} → {notification.toEmail} · {formatDate(notification.createdAt)}
                {notification.error ? ` · ${notification.error}` : ""}
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-ink/15 pt-2 font-sans text-[11px] text-ink/75">
                {notification.body}
              </pre>
              {notification.paperId ? (
                <Link
                  href={`/moderation/${notification.paperId}`}
                  prefetch={false}
                  className="pv-link self-start font-mono text-[11px]"
                >
                  Open paper →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
