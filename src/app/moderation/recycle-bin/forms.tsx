"use client";

import { useActionState } from "react";
import {
  purgePaperAction,
  restorePaperAction,
  softDeletePaperAction,
} from "@/server/actions/recycle-bin";
import { idle } from "@/server/actions/types";
import { FormBanner, SubmitButton } from "@/components/Form";

export function RestoreForm({ paperId }: { paperId: string }) {
  const [state, action, statePending] = useActionState(restorePaperAction, idle);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="paperId" value={paperId} />
      <SubmitButton className="px-3 py-1 text-xs" pendingLabel="Restoring…">
        Restore
      </SubmitButton>
    </form>
  );
}

export function PurgeForm({ paperId }: { paperId: string }) {
  const [state, action, statePending] = useActionState(purgePaperAction, idle);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this paper and its file for good? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
      className="inline-flex items-center gap-2"
    >
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="paperId" value={paperId} />
      <SubmitButton variant="secondary" className="px-3 py-1 text-xs" pendingLabel="Deleting…">
        Delete for good
      </SubmitButton>
    </form>
  );
}

export function SoftDeleteForm({ paperId }: { paperId: string }) {
  const [state, action, statePending] = useActionState(softDeletePaperAction, idle);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Move this paper to the recycle bin?")) event.preventDefault();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="paperId" value={paperId} />
      <div className="grow">
        <label className="pv-label" htmlFor={`delete-reason-${paperId}`}>
          Reason for removal
        </label>
        <input
          id={`delete-reason-${paperId}`}
          name="reason"
          className="pv-input"
          placeholder="e.g. Copyright notice upheld"
          maxLength={500}
        />
      </div>
      <SubmitButton variant="secondary" className="px-3 py-2" pendingLabel="Removing…">
        Move to recycle bin
      </SubmitButton>
    </form>
  );
}
