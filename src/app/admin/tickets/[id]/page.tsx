import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, PageHeading, Panel } from "@/components/ui";
import { AdminActionForm } from "@/components/AdminActionForm";
import { adminTicketDetail } from "@/server/services/tickets";
import { adminTicketReplyAction, adminTicketUpdateAction } from "@/server/actions/support";
import {
  ROLE_LABEL,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TICKET_STATUS_LABEL,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Ticket · Admin", robots: { index: false } };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getSessionUser();
  if (!actor) redirect(`/login?next=/admin/tickets/${id}`);
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;
  const t = await adminTicketDetail(actor, id);
  if (!t) notFound();
  const statusOptions = TICKET_STATUS.map((s) => ({ value: s, label: TICKET_STATUS_LABEL[s] }));

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin/tickets" />
      <PageHeading
        eyebrow={`${t.number} · ${TICKET_CATEGORY_LABEL[t.category as TicketCategory] ?? t.category}`}
        title={t.subject}
        description={`Opened ${formatDate(t.createdAt)} by ${t.requester.name} (${t.requester.email})`}
        aside={<Chip>{TICKET_STATUS_LABEL[t.status as TicketStatus] ?? t.status}</Chip>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {(t.collegeRequest || t.subjectRequest) ? (
            <Panel className="px-4 py-3">
              <p className="font-sans text-xs">
                This ticket carries a {t.collegeRequest ? "college" : "subject"} request (
                {(t.collegeRequest ?? t.subjectRequest)!.status.replace(/_/g, " ").toLowerCase()}).{" "}
                <Link href="/admin/requests" prefetch={false} className="pv-link">Decide it in Requests</Link>.
              </p>
            </Panel>
          ) : null}
          {t.relatedPaper || t.relatedUser || t.relatedComment ? (
            <Panel className="px-4 py-3">
              <p className="font-sans text-xs">
                About:{" "}
                {t.relatedPaper ? (
                  <Link href={`/moderation/${t.relatedPaper.id}`} prefetch={false} className="pv-link">
                    paper “{t.relatedPaper.title}” ({t.relatedPaper.status.toLowerCase()})
                  </Link>
                ) : null}
                {t.relatedUser ? (
                  <Link href={`/admin/users/${t.relatedUser.id}`} prefetch={false} className="pv-link">
                    member {t.relatedUser.name} ({t.relatedUser.status.toLowerCase()})
                  </Link>
                ) : null}
                {t.relatedComment ? (
                  <Link href={`/papers/${t.relatedComment.paperId}#comment-${t.relatedComment.id}`} prefetch={false} className="pv-link">
                    comment: “{t.relatedComment.body.slice(0, 80)}”
                  </Link>
                ) : null}
              </p>
            </Panel>
          ) : null}
          <Panel className="px-4 py-4" testId="admin-ticket-thread">
            <ol className="flex flex-col gap-3">
              {t.messages.map((m) => (
                <li
                  key={m.id}
                  data-internal={m.internal ? "1" : undefined}
                  className={
                    m.internal
                      ? "pv-panel-flat bg-yellow px-3 py-2"
                      : m.authorId === t.requesterId
                        ? "pv-panel-flat bg-paper px-3 py-2"
                        : "pv-panel-flat bg-blue-soft px-3 py-2"
                  }
                >
                  <p className="font-mono text-[11px] text-ink/60">
                    {m.internal ? "Internal note · " : ""}
                    {m.author?.name ?? "Deleted account"}
                    {m.author ? ` (${ROLE_LABEL[m.author.role as keyof typeof ROLE_LABEL] ?? m.author.role})` : ""} ·{" "}
                    {formatDate(m.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap font-sans text-sm">{m.body}</p>
                  {m.attachments.length ? (
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {m.attachments.map((a) => (
                        <li key={a.id}>
                          <a href={`/api/tickets/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="pv-link font-mono text-[11px]">
                            {a.originalName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel className="px-4 py-4">
            <h2 className="pv-section-title mb-2">Reply to member</h2>
            <AdminActionForm
              action={adminTicketReplyAction}
              hidden={{ ticketId: t.id, internal: "0" }}
              fields={[
                { name: "body", label: "Message (the member sees this)", type: "textarea", required: true, maxLength: 5000 },
                {
                  name: "status",
                  label: "Then set status to",
                  type: "select",
                  defaultValue: "WAITING_FOR_USER",
                  options: statusOptions,
                },
              ]}
              submitLabel="Send reply"
              variant="primary"
              testId="admin-reply"
            />
          </Panel>
          <Panel className="px-4 py-4">
            <h2 className="pv-section-title mb-2">Internal note</h2>
            <AdminActionForm
              action={adminTicketReplyAction}
              hidden={{ ticketId: t.id, internal: "1" }}
              fields={[{ name: "body", label: "Admins only — never shown to the member", type: "textarea", required: true, maxLength: 5000 }]}
              submitLabel="Add internal note"
              testId="admin-note"
            />
          </Panel>
        </div>
        <aside className="flex flex-col gap-4">
          <Panel className="px-4 py-4">
            <h2 className="pv-section-title mb-2">Ticket</h2>
            <AdminActionForm
              action={adminTicketUpdateAction}
              hidden={{ ticketId: t.id }}
              fields={[
                { name: "status", label: "Status", type: "select", defaultValue: t.status, options: statusOptions },
                {
                  name: "priority",
                  label: "Priority",
                  type: "select",
                  defaultValue: t.priority,
                  options: TICKET_PRIORITY.map((p) => ({ value: p, label: p.toLowerCase() })),
                },
                {
                  name: "assigneeId",
                  label: "Assigned to",
                  type: "select",
                  defaultValue: t.assigneeId ?? "",
                  options: [{ value: "", label: "Unassigned" }, ...t.admins.map((a) => ({ value: a.id, label: a.name }))],
                },
              ]}
              submitLabel="Save"
              testId="admin-ticket-update"
            />
          </Panel>
          <Panel className="px-4 py-4">
            <h2 className="pv-section-title mb-2">Requester</h2>
            <p className="font-sans text-xs">
              <Link href={`/admin/users/${t.requester.id}`} prefetch={false} className="pv-link">{t.requester.name}</Link>
              <br />
              {ROLE_LABEL[t.requester.role as keyof typeof ROLE_LABEL] ?? t.requester.role} · {t.requester.status.toLowerCase()}
            </p>
          </Panel>
          <Panel className="px-4 py-4">
            <h2 className="pv-section-title mb-2">History</h2>
            <ol className="flex flex-col gap-1">
              {t.events.map((e) => (
                <li key={e.id} className="font-sans text-[11px] text-ink/70">
                  {formatDate(e.createdAt)} · {e.type.replace(/_/g, " ")}
                  {e.type !== "assigned" && e.toValue ? `: ${e.fromValue ? `${e.fromValue.toLowerCase()} → ` : ""}${e.toValue.toLowerCase()}` : ""}
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
