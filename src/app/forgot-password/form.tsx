"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/server/actions/auth";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";

export function ForgotPasswordForm() {
  const [state, action, statePending] = useActionState(forgotPasswordAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormBanner pending={statePending} state={state} />
      <div>
        <label className="pv-label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="pv-input"
        />
        <FieldError error={state.fieldErrors?.email} />
      </div>
      <SubmitButton className="self-start px-4 py-2" pendingLabel="Sending…">
        Email me a reset link
      </SubmitButton>
    </form>
  );
}
