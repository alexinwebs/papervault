import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, EmptyState, PageHeading, Pagination, Panel } from "@/components/ui";
import { adminTicketList } from "@/server/services/tickets";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TICKET_STATUS_LABEL,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Tickets · Admin", robots: { index: false } };

type Search = { status?: string; category?: string; priority?: string; q?: string; mine?: string; page?: string };

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/tickets");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;
  const sp = await searchParams;
  const status = sp.status && (sp.status === "ALL" || (TICKET_STATUS as readonly string[]).includes(sp.status)) ? sp.status : "";
  const category = (TICKET_CATEGORIES as readonly string[]).includes(sp.category ?? "") ? sp.category : "";
  const priority = (TICKET_PRIORITY as readonly string[]).includes(sp.priority ?? "") ? sp.priority : "";
  const list = await adminTicketList(actor, {
    status: status || undefined,
    category: category || undefined,
    priority: priority || undefined,
    q: sp.q?.trim() || undefined,
    mine: sp.mine === "1",
    page: Number(sp.page) || 1,
  });
  const open = ["OPEN", "IN_REVIEW", "WAITING_FOR_ADMIN", "WAITING_FOR_USER"].reduce((n, s) => n + (list.counts[s] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Support tickets"
        description={`${open} open · ${list.counts.WAITING_FOR_ADMIN ?? 0} waiting on us. Urgent and high priority first, then oldest activity.`}
        aside={
          <Link href="/admin/requests" prefetch={false} className="pv-btn-secondary px-3 py-1.5 text-xs">
            College & subject requests
          </Link>
        }
      />
      <Panel className="px-4 py-4">
        <form method="get" className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <div className="sm:col-span-2">
            <label htmlFor="tq" className="pv-label">Search number, title or email</label>
            <input id="tq" name="q" defaultValue={sp.q ?? ""} className="pv-input" placeholder="PV-2026-…" />
          </div>
          <div>
            <label htmlFor="ts" className="pv-label">Status</label>
            <select id="ts" name="status" defaultValue={status} className="pv-input">
              <option value="">Open (all active)</option>
              {TICKET_STATUS.map((s) => (
                <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}{list.counts[s] ? ` · ${list.counts[s]}` : ""}</option>
              ))}
              <option value="ALL">All</option>
            </select>
          </div>
          <div>
            <label htmlFor="tc" className="pv-label">Category</label>
            <select id="tc" name="category" defaultValue={category} className="pv-input">
              <option value="">Any</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{TICKET_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="pv-checkbox-row font-sans text-xs">
              <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} className="pv-checkbox" /> Mine
            </label>
            <button type="submit" className="pv-btn-primary px-4 py-2 text-xs">Filter</button>
          </div>
        </form>
      </Panel>
      {list.rows.length === 0 ? (
        <EmptyState title="No tickets" body="Nothing matches these filters." />
      ) : (
        <Panel className="px-4 py-4">
          <ul className="flex flex-col gap-2" data-testid="admin-ticket-list">
            {list.rows.map((t) => (
              <li key={t.id} className="pv-row flex-wrap justify-between gap-2">
                <div className="flex flex-col">
                  <Link href={`/admin/tickets/${t.id}`} prefetch={false} className="pv-link font-mono text-sm">
                    {t.number} · {t.subject}
                  </Link>
                  <span className="font-sans text-[11px] text-ink/60">
                    {TICKET_CATEGORY_LABEL[t.category as TicketCategory] ?? t.category} · {t.requester.name} · updated{" "}
                    {formatDate(t.lastActivityAt)}
                    {t.assignee ? ` · assigned to ${t.assignee.name}` : " · unassigned"}
                  </span>
                </div>
                <span className="flex gap-1">
                  {t.priority === "URGENT" || t.priority === "HIGH" ? <Chip accent="pink">{t.priority.toLowerCase()}</Chip> : null}
                  <Chip>{TICKET_STATUS_LABEL[t.status as TicketStatus] ?? t.status}</Chip>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Pagination
        page={list.page}
        pages={Math.max(1, Math.ceil(list.total / list.pageSize))}
        total={list.total}
        perPage={list.pageSize}
        params={{ status, category, priority, q: sp.q, mine: sp.mine }}
        label="tickets"
      />
    </div>
  );
}
