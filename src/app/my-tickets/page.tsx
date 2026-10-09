import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackBar, Chip, EmptyState, PageHeading, Panel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, type TicketCategory, type TicketStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { myTickets } from "@/server/services/tickets";

export const metadata: Metadata = { title: "My tickets", robots: { index: false } };

export default async function MyTicketsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/my-tickets");
  const tickets = await myTickets(user);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <BackBar fallback="/" />
      <PageHeading
        eyebrow="Help"
        title="My tickets"
        description="Your support tickets and requests, most recent activity first."
        aside={
          <Link href="/support" className="pv-btn-primary px-3 py-1.5 text-xs" prefetch={false}>
            New ticket
          </Link>
        }
      />
      {tickets.length === 0 ? (
        <EmptyState title="No tickets yet" body="When you open a support ticket it will appear here." />
      ) : (
        <Panel className="px-4 py-4">
          <ul className="flex flex-col gap-2" data-testid="my-tickets">
            {tickets.map((t) => (
              <li key={t.id} className="pv-row flex-wrap justify-between gap-2">
                <div className="flex flex-col">
                  <Link href={`/my-tickets/${t.id}`} prefetch={false} className="pv-link font-mono text-sm">
                    {t.number} · {t.subject}
                  </Link>
                  <span className="font-sans text-[11px] text-ink/60">
                    {TICKET_CATEGORY_LABEL[t.category as TicketCategory] ?? t.category} · updated {formatDate(t.lastActivityAt)}
                  </span>
                </div>
                <Chip>{TICKET_STATUS_LABEL[t.status as TicketStatus] ?? t.status}</Chip>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
