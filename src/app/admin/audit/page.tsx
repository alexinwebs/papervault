import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, EmptyState, PageHeading, Pagination, Panel } from "@/components/ui";
import { auditPage } from "@/server/services/audit";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log · Admin", robots: { index: false } };

const ENTITY_TYPES = [
  "User",
  "Paper",
  "College",
  "Subject",
  "Report",
  "UserReport",
  "SupportTicket",
  "CollegeRequest",
  "SubjectRequest",
  "TeacherVerificationRequest",
  "TeacherVerificationDocument",
  "TakedownRequest",
];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/audit");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;
  const sp = await searchParams;
  const type = ENTITY_TYPES.includes(sp.type ?? "") ? sp.type : undefined;
  const log = await auditPage({ q: sp.q, entityType: type, page: Number(sp.page) || 1 });

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Audit log"
        description="Append-only. Entries cannot be edited or deleted from the app; the database rejects updates."
      />
      <Panel className="px-4 py-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <div>
            <label htmlFor="aq" className="pv-label">Action, entity id or actor email</label>
            <input id="aq" name="q" defaultValue={sp.q ?? ""} className="pv-input" placeholder="teacher_verification, ticket.updated…" />
          </div>
          <div>
            <label htmlFor="at" className="pv-label">Entity</label>
            <select id="at" name="type" defaultValue={type ?? ""} className="pv-input">
              <option value="">Any</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="pv-btn-primary px-4 py-2 text-xs">Search</button>
        </form>
      </Panel>
      {log.rows.length === 0 ? (
        <EmptyState title="No entries" body="Nothing matches this search." />
      ) : (
        <div className="pv-table-wrap">
          <table className="pv-table" data-testid="audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {log.rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap font-mono text-[11px]">{formatDate(row.createdAt)}</td>
                  <td className="font-sans text-xs">{row.actor?.name ?? "system"}</td>
                  <td className="font-mono text-xs">{row.action}</td>
                  <td className="font-mono text-[11px]">
                    {row.entityType} {row.entityId ? `· ${row.entityId.slice(-10)}` : ""}
                  </td>
                  <td className="font-sans text-xs">{row.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={log.page}
        pages={Math.max(1, Math.ceil(log.total / log.pageSize))}
        total={log.total}
        perPage={log.pageSize}
        params={{ q: sp.q, type }}
        label="entries"
      />
    </div>
  );
}
