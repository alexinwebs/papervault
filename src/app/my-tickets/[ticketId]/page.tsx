import { SuccessPopup } from "@/components/SuccessPopup";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackBar, Chip, PageHeading, Panel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import {
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { ticketForRequester } from "@/server/services/tickets";
import { CloseTicketForm, TicketReplyForm } from "../../support/forms";

export const metadata: Metadata = { title: "Ticket", robots: { index: false } };

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { ticketId } = await params;
  const { created } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/my-tickets/${ticketId}`);
  let ticket;
  try {
    ticket = await ticketForRequester(user, ticketId);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const status = ticket.status as TicketStatus;
  const request = ticket.collegeRequest ?? ticket.subjectRequest;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <BackBar fallback="/my-tickets" />
      <PageHeading
        eyebrow={`${ticket.number} · ${TICKET_CATEGORY_LABEL[ticket.category as TicketCategory] ?? ticket.category}`}
        title={ticket.subject}
        description={`Opened ${formatDate(ticket.createdAt)}`}
        aside={<Chip>{TICKET_STATUS_LABEL[status] ?? status}</Chip>}
      />
      {created ? (
        <SuccessPopup message={`Ticket ${ticket.number} created. We'll notify you when the team replies.`} testId="ticket-created" />
      ) : null}
      {request ? (
        <Panel className="px-4 py-3">
          <p className="font-sans text-xs">
            Request status: <strong>{request.status.replace(/_/g, " ").toLowerCase()}</strong>
            {request.decisionNote ? ` — ${request.decisionNote}` : ""}
          </p>
        </Panel>
      ) : null}
      <Panel className="px-4 py-4" testId="ticket-thread">
        <ol className="flex flex-col gap-3">
          {ticket.messages.map((m) => (
            <li key={m.id} className={m.fromStaff ? "pv-panel-flat bg-blue-soft px-3 py-2" : "pv-panel-flat bg-paper px-3 py-2"}>
              <p className="font-mono text-[11px] text-ink/60">
                {m.authorName} · {formatDate(m.createdAt)}
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
      {status !== "CLOSED" ? (
        <Panel className="px-4 py-4">
          <TicketReplyForm ticketId={ticket.id} maxBytes={TICKET_ATTACHMENT_MAX_BYTES} />
          <div className="mt-4 border-t border-ink/10 pt-3">
            <CloseTicketForm ticketId={ticket.id} />
          </div>
        </Panel>
      ) : (
        <p className="font-sans text-xs text-ink/60">This ticket is closed. Open a new ticket if you need more help.</p>
      )}
    </div>
  );
}
