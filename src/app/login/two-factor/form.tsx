"use client";

import { useActionState } from "react";
import { cancelTwoFactorAction, verifyTwoFactorAction } from "@/server/actions/two-factor";
import { idle } from "@/server/actions/types";
import { FormBanner, SubmitButton } from "@/components/Form";

export function TwoFactorChallengeForm() {
  const [state, action] = useActionState(verifyTwoFactorAction, idle);
  return (
    <>
      <form action={action} className="flex flex-col gap-3">
        <FormBanner state={state} />
        <div>
          <label className="pv-label" htmlFor="token">
            Verification code
          </label>
          <input
            id="token"
            name="token"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder="123456"
            className="pv-input font-mono tracking-[0.3em]"
          />
        </div>
        <SubmitButton className="px-4 py-2" pendingLabel="Checking…">
          Verify and sign in
        </SubmitButton>
      </form>
      <form action={cancelTwoFactorAction}>
        <button type="submit" className="pv-link font-sans text-xs text-ink/70">
          Cancel and sign in as someone else
        </button>
      </form>
    </>
  );
}
