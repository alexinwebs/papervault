"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/server/actions/auth";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <FormBanner state={state} />
      <div>
        <label className="pv-label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="pv-input"
        />
        <p className="mt-1 font-sans text-[11px] text-ink/55">
          At least 10 characters, with a letter and a number.
        </p>
        <FieldError error={state.fieldErrors?.password} />
      </div>
      <div>
        <label className="pv-label" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="pv-input"
        />
        <FieldError error={state.fieldErrors?.confirmPassword} />
      </div>
      <SubmitButton className="self-start px-4 py-2" pendingLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
