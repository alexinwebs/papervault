"use client";

import { useActionState } from "react";
import { openInboxMessageAction, markAllInboxReadAction, markInboxReadAction } from "@/server/actions/inbox";
import { idle } from "@/server/actions/types";
import { FormBanner, SubmitButton } from "@/components/Form";

export function MarkReadForm({ id }: { id: string }) {
  const [state, action, statePending] = useActionState(markInboxReadAction, idle);
  return (
    <form action={action}>
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" className="px-3 py-1 text-xs" pendingLabel="…">
        Mark as read
      </SubmitButton>
    </form>
  );
}

export function MarkAllReadForm() {
  const [state, action, statePending] = useActionState(markAllInboxReadAction, idle);
  return (
    <form action={action}>
      <FormBanner pending={statePending} state={state} />
      <SubmitButton className="px-3 py-2" pendingLabel="Marking…">
        Mark all as read
      </SubmitButton>
    </form>
  );
}

export function OpenMessageForm({ id }: { id: string }) {
  const [state, action, statePending] = useActionState(openInboxMessageAction, idle);
  return (
    <form action={action}>
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" className="px-3 py-1 text-xs" pendingLabel="Opening…">Open</SubmitButton>
    </form>
  );
}
