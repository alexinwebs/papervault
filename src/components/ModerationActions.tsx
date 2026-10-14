"use client";

import { useActionState } from "react";
import { moderateAction, resolveReportAction } from "@/server/actions/moderation";
import { resolveTakedownAction } from "@/server/actions/takedowns";
import { idle } from "@/server/actions/types";
import { FormBanner, SubmitButton } from "./Form";
import { EXAM_CLASSIFICATION, EXAM_CLASSIFICATION_LABEL, type ExamClassification } from "@/lib/constants";

export function ModerationPanel({
  paperId,
  status,
  duplicates,
  classification = "UNKNOWN",
}: {
  paperId: string;
  status: string;
  duplicates: { id: string; title: string; status: string }[];
  classification?: string;
}) {
  const [state, action, statePending] = useActionState(moderateAction, idle);

  return (
    <form action={action} className="flex flex-col gap-3">
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="paperId" value={paperId} />

      <div>
        <label className="pv-label" htmlFor={`action-${paperId}`}>
          Decision
        </label>
        <select id={`action-${paperId}`} name="action" className="pv-input" defaultValue="APPROVE">
          <option value="APPROVE">Approve</option>
          <option value="PUBLISH">Publish</option>
          <option value="REQUEST_CHANGES">Request changes</option>
          <option value="REJECT">Reject</option>
          <option value="RESTRICT">Restrict</option>
          {duplicates.length > 0 ? <option value="MERGE">Merge into canonical paper</option> : null}
        </select>
        <p className="mt-1 font-sans text-[11px] text-ink/60">
          Current state: {status.replace(/_/g, " ").toLowerCase()}. Publish approves it too, and lifts an automatic restriction.
        </p>
      </div>

      <div>
        <label className="pv-label" htmlFor={`classification-${paperId}`}>
          Exam classification
        </label>
        <select id={`classification-${paperId}`} name="examClassification" className="pv-input" defaultValue="">
          <option value="">Keep: {EXAM_CLASSIFICATION_LABEL[classification as ExamClassification] ?? classification}</option>
          {EXAM_CLASSIFICATION.map((c) => (
            <option key={c} value={c}>
              {EXAM_CLASSIFICATION_LABEL[c]}
            </option>
          ))}
        </select>
        <p className="mt-1 font-sans text-[11px] text-ink/60">
          Only past or officially released papers can be approved or published. Unknown counts as past only when the exam year is over.
        </p>
      </div>

      <div>
        <label className="pv-label" htmlFor={`verification-${paperId}`}>
          Verification level
        </label>
        <select
          id={`verification-${paperId}`}
          name="verification"
          className="pv-input"
          defaultValue="MODERATOR_VERIFIED"
        >
          <option value="MODERATOR_VERIFIED">Moderator verified</option>
          <option value="COLLEGE_VERIFIED">College verified</option>
          <option value="COMMUNITY_VERIFIED">Community verified</option>
          <option value="UNVERIFIED">Unverified</option>
        </select>
      </div>

      {duplicates.length > 0 ? (
        <div>
          <label className="pv-label" htmlFor={`canonical-${paperId}`}>
            Canonical paper (for merge)
          </label>
          <select id={`canonical-${paperId}`} name="canonicalPaperId" className="pv-input" defaultValue="">
            <option value="">—</option>
            {duplicates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} · {d.status.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="pv-label" htmlFor={`note-${paperId}`}>
          Note (stored in the audit log)
        </label>
        <textarea id={`note-${paperId}`} name="note" rows={3} className="pv-input" maxLength={500} />
      </div>

      <SubmitButton pendingLabel="Applying…" className="self-start">
        Apply decision
      </SubmitButton>
    </form>
  );
}

export function ResolveReportForm({ reportId }: { reportId: string }) {
  const [state, action, statePending] = useActionState(resolveReportAction, idle);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="reportId" value={reportId} />
      <input
        name="resolution"
        className="pv-input max-w-xs"
        placeholder="Resolution note"
        maxLength={300}
        aria-label="Resolution note"
      />
      <button type="submit" name="status" value="RESOLVED" className="pv-btn-primary">
        Resolve
      </button>
      <button type="submit" name="status" value="DISMISSED" className="pv-btn-secondary">
        Dismiss
      </button>
    </form>
  );
}

export function ResolveTakedownForm({ id, status = "OPEN" }: { id: string; status?: string }) {
  const [state, action, statePending] = useActionState(resolveTakedownAction, idle);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="id" value={id} />
      <input
        name="resolution"
        className="pv-input max-w-sm"
        placeholder="What did you do, and why?"
        maxLength={2000}
        aria-label="Resolution note"
      />
      {status === "OPEN" ? (
        <button type="submit" name="status" value="UNDER_REVIEW" className="pv-btn-secondary">
          Under review
        </button>
      ) : null}
      {status === "OPEN" || status === "UNDER_REVIEW" ? (
        <>
          <button type="submit" name="status" value="ACTIONED" className="pv-btn-primary">
            Actioned
          </button>
          <button type="submit" name="status" value="REJECTED" className="pv-btn-secondary">
            Decline
          </button>
        </>
      ) : null}
      {status === "ACTIONED" ? (
        <button type="submit" name="status" value="REVIEW_REQUESTED" className="pv-btn-secondary">
          Review requested
        </button>
      ) : null}
      {status === "REVIEW_REQUESTED" ? (
        <button type="submit" name="status" value="RESTORED" className="pv-btn-primary">
          Restored
        </button>
      ) : null}
      <button type="submit" name="status" value="CLOSED" className="pv-btn-secondary">
        Close
      </button>
    </form>
  );
}
