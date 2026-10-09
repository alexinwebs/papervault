"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/Form";
import { idle } from "@/server/actions/types";
import { memberActionAction } from "@/server/actions/admin";

/**
 * One-click account action. Destructive branches ask for confirmation first,
 * and `withReason` prompts for the text stored on the ban record.
 */
export function MemberActionButton({
  userId,
  action,
  label,
  confirm,
  withReason = false,
  disabled = false,
}: {
  userId: string;
  action: "BAN" | "UNBAN" | "VERIFY_EMAIL" | "RESET_2FA" | "REVOKE_SESSIONS";
  label: string;
  confirm?: string;
  withReason?: boolean;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(memberActionAction, idle);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
          return;
        }
        if (withReason) {
          const reason = window.prompt("Reason (shown in the audit log):", "");
          if (reason === null) {
            event.preventDefault();
            return;
          }
          const field = event.currentTarget.elements.namedItem("reason");
          if (field instanceof HTMLInputElement) field.value = reason.slice(0, 200);
        }
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="action" value={action} />
      {withReason ? <input type="hidden" name="reason" defaultValue="" /> : null}
      <SubmitButton variant="secondary" pendingLabel="…" className="px-3 py-1 text-xs" disabled={disabled}>
        {label}
      </SubmitButton>
      {state.message && !state.ok ? (
        <span role="status" className="font-sans text-[11px] text-red-700">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
