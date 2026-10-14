"use client";

import { useActionState, useState } from "react";
import { createTicketAction, closeTicketAction, replyTicketAction } from "@/server/actions/support";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";
import { DocumentPicker } from "@/components/DocumentPicker";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, type TicketCategory } from "@/lib/constants";

function newToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

export function NewTicketForm({
  colleges,
  defaults,
  maxBytes,
}: {
  colleges: { id: string; name: string }[];
  defaults: {
    category: TicketCategory | "";
    subject: string;
    relatedPaperId: string;
    relatedCommentId: string;
    relatedUserId: string;
    relatedLabel: string;
  };
  maxBytes: number;
}) {
  const [state, action, statePending] = useActionState(createTicketAction, idle);
  const [category, setCategory] = useState<string>(defaults.category);
  const [token] = useState(newToken);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" data-testid="new-ticket">
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="clientToken" value={token} />
      <input type="hidden" name="relatedPaperId" value={defaults.relatedPaperId} />
      <input type="hidden" name="relatedCommentId" value={defaults.relatedCommentId} />
      <input type="hidden" name="relatedUserId" value={defaults.relatedUserId} />
      <div>
        <label className="pv-label" htmlFor="category">
          What do you need help with?
        </label>
        <select
          id="category"
          name="category"
          className="pv-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose a category
          </option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TICKET_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <FieldError error={err.category} />
      </div>
      {defaults.relatedLabel ? (
        <p className="pv-panel-flat bg-paper px-3 py-2 font-sans text-xs">About: {defaults.relatedLabel}</p>
      ) : null}

      {category === "ADD_COLLEGE" ? (
        <fieldset className="grid gap-3 sm:grid-cols-2" data-testid="college-fields">
          <legend className="pv-label sm:col-span-2">College details</legend>
          <div className="sm:col-span-2">
            <label className="pv-label" htmlFor="collegeName">Full college name</label>
            <input id="collegeName" name="collegeName" className="pv-input" maxLength={160} required />
            <FieldError error={err.collegeName} />
          </div>
          <div className="sm:col-span-2">
            <label className="pv-label" htmlFor="collegeUniversity">Affiliating university</label>
            <input id="collegeUniversity" name="collegeUniversity" className="pv-input" maxLength={160} required />
            <FieldError error={err.collegeUniversity} />
          </div>
          <div>
            <label className="pv-label" htmlFor="collegeCity">City</label>
            <input id="collegeCity" name="collegeCity" className="pv-input" maxLength={60} required />
            <FieldError error={err.collegeCity} />
          </div>
          <div>
            <label className="pv-label" htmlFor="collegeState">State</label>
            <input id="collegeState" name="collegeState" className="pv-input" maxLength={60} required />
            <FieldError error={err.collegeState} />
          </div>
          <div className="sm:col-span-2">
            <label className="pv-label" htmlFor="collegeWebsite">Official website (optional)</label>
            <input id="collegeWebsite" name="collegeWebsite" type="url" className="pv-input" maxLength={200} placeholder="https://" />
            <FieldError error={err.collegeWebsite} />
          </div>
        </fieldset>
      ) : null}

      {category === "ADD_SUBJECT" ? (
        <fieldset className="grid gap-3 sm:grid-cols-2" data-testid="subject-fields">
          <legend className="pv-label sm:col-span-2">Subject details</legend>
          <div className="sm:col-span-2">
            <label className="pv-label" htmlFor="subjectCollegeId">College</label>
            <select id="subjectCollegeId" name="subjectCollegeId" className="pv-input" defaultValue="" required>
              <option value="" disabled>
                Choose the college
              </option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError error={err.subjectCollegeId} />
          </div>
          <div>
            <label className="pv-label" htmlFor="subjectName">Subject name</label>
            <input id="subjectName" name="subjectName" className="pv-input" maxLength={140} required />
            <FieldError error={err.subjectName} />
          </div>
          <div>
            <label className="pv-label" htmlFor="subjectCode">Subject code (if known)</label>
            <input id="subjectCode" name="subjectCode" className="pv-input" maxLength={20} />
            <FieldError error={err.subjectCode} />
          </div>
          <p className="font-sans text-[11px] text-ink/60 sm:col-span-2">
            Mention the degree, branch and semester in the description below.
          </p>
        </fieldset>
      ) : null}

      <div>
        <label className="pv-label" htmlFor="subject">Title</label>
        <input id="subject" name="subject" className="pv-input" maxLength={140} required defaultValue={defaults.subject} />
        <FieldError error={err.subject} />
      </div>
      <div>
        <label className="pv-label" htmlFor="body">Description</label>
        <textarea id="body" name="body" className="pv-input min-h-32" maxLength={5000} required />
        <FieldError error={err.body} />
      </div>
      <DocumentPicker
        name="attachments"
        label="Attachments (optional)"
        maxFiles={3}
        maxBytes={maxBytes}
        hint="Don't attach other people's personal documents."
      />
      <SubmitButton className="self-start" testId="create-ticket">
        Create ticket
      </SubmitButton>
    </form>
  );
}

export function TicketReplyForm({ ticketId, maxBytes }: { ticketId: string; maxBytes: number }) {
  const [state, action, statePending] = useActionState(replyTicketAction, idle);
  const [token, setToken] = useState(newToken);
  const err = state.fieldErrors ?? {};
  return (
    <form
      action={(fd) => {
        action(fd);
        setToken(newToken());
      }}
      className="flex flex-col gap-3"
      data-testid="ticket-reply"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="clientToken" value={token} />
      <label className="pv-label" htmlFor="reply-body">Reply</label>
      <textarea id="reply-body" name="body" className="pv-input min-h-24" maxLength={5000} required />
      <FieldError error={err.body} />
      <DocumentPicker name="attachments" label="Attachments (optional)" maxFiles={3} maxBytes={maxBytes} />
      <SubmitButton className="self-start">Send reply</SubmitButton>
      <FormBanner pending={statePending} state={state} />
    </form>
  );
}

export function CloseTicketForm({ ticketId }: { ticketId: string }) {
  const [state, action, statePending] = useActionState(closeTicketAction, idle);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Close this ticket? You can open a new one later.")) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <SubmitButton variant="secondary" className="self-start px-3 py-1.5 text-xs">
        Close ticket
      </SubmitButton>
      <FormBanner pending={statePending} state={state} />
    </form>
  );
}
