"use client";

import { useActionState } from "react";
import { markAllInboxReadAction, markInboxReadAction } from "@/server/actions/inbox";
import { idle } from "@/server/actions/types";
import { SubmitButton } from "@/components/Form";

export function MarkReadForm({ id }: { id: string }) {
  const [, action] = useActionState(markInboxReadAction, idle);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" className="px-3 py-1 text-xs" pendingLabel="…">
        Mark as read
      </SubmitButton>
    </form>
  );
}

export function MarkAllReadForm() {
  const [, action] = useActionState(markAllInboxReadAction, idle);
  return (
    <form action={action}>
      <SubmitButton className="px-3 py-2" pendingLabel="Marking…">
        Mark all as read
      </SubmitButton>
    </form>
  );
}
