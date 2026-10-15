"use client";

import { SuccessPopup } from "@/components/SuccessPopup";
import { useActionState, useState } from "react";
import { Bookmark, BookmarkCheck, Flag } from "lucide-react";
import { reportPaperAction, toggleBookmarkAction, requestPaperAction } from "@/server/actions/papers";
import { safeLocalPath } from "@/lib/utils";
import { idle } from "@/server/actions/types";
import { reportUserAction } from "@/server/actions/support";
import { REPORT_REASONS, REPORT_REASON_LABEL, USER_REPORT_REASONS, USER_REPORT_REASON_LABEL } from "@/lib/constants";
import { FormBanner, SubmitButton } from "./Form";

export function BookmarkButton({ paperId, saved }: { paperId: string; saved: boolean }) {
  const [state, action, statePending] = useActionState(toggleBookmarkAction, idle);
  const isSaved = state.ok ? state.message?.startsWith("Saved") : saved;
  return (
    <form action={action}>
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="paperId" value={paperId} />
      <SubmitButton variant="secondary" pendingLabel="Saving…">
        {isSaved ? (
          <>
            <BookmarkCheck className="h-4 w-4" aria-hidden /> Saved
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" aria-hidden /> Save
          </>
        )}
      </SubmitButton>
    </form>
  );
}

export function ReportDialog({ paperId }: { paperId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, statePending] = useActionState(reportPaperAction, idle);

  return (
    <div className="relative">
      <button type="button" className="pv-btn-secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Flag className="h-4 w-4" aria-hidden /> Report
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Report this paper"
          className="absolute right-0 z-20 mt-2 w-[min(92vw,360px)] border-2 border-ink rounded-sm bg-cream p-4 shadow-hard"
        >
          <form action={action} className="flex flex-col gap-3">
            <FormBanner pending={statePending} state={state} />
            <input type="hidden" name="paperId" value={paperId} />
            <div>
              <label className="pv-label" htmlFor={`reason-${paperId}`}>
                Why are you reporting this?
              </label>
              <select id={`reason-${paperId}`} name="reason" className="pv-input" required>
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REPORT_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="pv-label" htmlFor={`details-${paperId}`}>
                Details (optional)
              </label>
              <textarea id={`details-${paperId}`} name="details" rows={3} className="pv-input" maxLength={600} />
            </div>
            <div className="flex gap-2">
              <SubmitButton pendingLabel="Sending…">Send report</SubmitButton>
              <button type="button" className="pv-btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function RequestPaperButton({
  subjectId,
  examTypeId,
  academicYear,
  signedIn,
  returnTo,
}: {
  subjectId: string;
  examTypeId: string;
  academicYear: number;
  signedIn: boolean;
  returnTo?: string;
}) {
  const [state, action, statePending] = useActionState(requestPaperAction, idle);
  if (!signedIn) {
    return (
      <a href={`/login?next=${encodeURIComponent(safeLocalPath(returnTo, "/requests"))}`} className="pv-btn-primary">
        Sign in to request
      </a>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="examTypeId" value={examTypeId} />
      <input type="hidden" name="academicYear" value={academicYear} />
      <FormBanner pending={statePending} state={state} />
      <SubmitButton pendingLabel="Recording…">Request this paper</SubmitButton>
    </form>
  );
}

export function ReportUserDialog({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, statePending] = useActionState(reportUserAction, idle);
  return (
    <div className="relative">
      <button type="button" className="pv-btn-secondary px-3 py-1.5 text-xs" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Flag className="h-4 w-4" aria-hidden /> Report member
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={`Report ${name}`}
          className="absolute left-0 z-20 mt-2 w-[min(92vw,360px)] border-2 border-ink rounded-sm bg-cream p-4 shadow-hard"
        >
          {state.ok ? (
            <SuccessPopup message={state.message} />
          ) : (
            <form action={action} className="flex flex-col gap-3">
              <FormBanner pending={statePending} state={state} />
              <input type="hidden" name="userId" value={userId} />
              <div>
                <label className="pv-label" htmlFor={`ur-reason-${userId}`}>
                  Why are you reporting {name}?
                </label>
                <select id={`ur-reason-${userId}`} name="reason" className="pv-input" required>
                  {USER_REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {USER_REPORT_REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pv-label" htmlFor={`ur-details-${userId}`}>
                  Details (optional)
                </label>
                <textarea id={`ur-details-${userId}`} name="details" rows={3} className="pv-input" maxLength={1000} />
              </div>
              <div className="flex gap-2">
                <SubmitButton pendingLabel="Sending…">Send report</SubmitButton>
                <button type="button" className="pv-btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
