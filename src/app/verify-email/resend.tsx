"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/server/actions/auth";
import { idle, type ActionState } from "@/server/actions/types";
import { FormBanner, SubmitButton } from "@/components/Form";

export function ResendVerification() {
  const [state, action] = useActionState(
    async (_prev: ActionState) => resendVerificationAction(),
    idle,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormBanner state={state} />
      <SubmitButton className="self-start px-4 py-2 text-xs" pendingLabel="Sending…">
        Resend confirmation link
      </SubmitButton>
    </form>
  );
}
