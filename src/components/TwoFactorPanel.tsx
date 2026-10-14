"use client";

import { PasswordInput } from "@/components/PasswordInput";
import { SuccessPopup } from "@/components/SuccessPopup";
import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import {
  confirmTotpAction,
  disableTotpAction,
  startTotpAction,
} from "@/server/actions/two-factor";
import { idle, type ActionState } from "@/server/actions/types";
import { FormBanner, SubmitButton } from "@/components/Form";

type Enrollment = { secret: string; formattedSecret: string; uri: string; qr: string };

function enrollmentFrom(state: ActionState): Enrollment | null {
  const data = state.data as Partial<Enrollment> | undefined;
  if (!data?.qr || !data.secret) return null;
  return {
    secret: data.secret,
    formattedSecret: data.formattedSecret ?? data.secret,
    uri: data.uri ?? "",
    qr: data.qr,
  };
}

export function TwoFactorPanel({
  enabled,
  required,
  recoveryRemaining,
}: {
  enabled: boolean;
  required: boolean;
  recoveryRemaining: number;
}) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const [confirmState, confirmAction, confirmStatePending] = useActionState(confirmTotpAction, idle);
  const [disableState, disableAction, disableStatePending] = useActionState(disableTotpAction, idle);

  const codes = (confirmState.data as { recoveryCodes?: string[] } | undefined)?.recoveryCodes;

  // Codes are shown exactly once, straight after confirmation.
  if (codes?.length) {
    return (
      <div className="flex flex-col gap-3">
        <SuccessPopup message={confirmState.message} />
        <p className="font-sans text-sm text-ink/80">
          Each code works once, if you lose your phone. Store them somewhere safe — they will not
          be shown again.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
          {codes.map((code) => (
            <li key={code} className="pv-panel-flat bg-cream px-2 py-1 text-center">
              {code}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-2 font-sans text-sm">
          <span className="pv-chip bg-mint">
            <ShieldCheck className="h-3 w-3" aria-hidden /> On
          </span>
          <span className="text-ink/75">
            {recoveryRemaining} recovery {recoveryRemaining === 1 ? "code" : "codes"} left.
          </span>
        </p>
        {required ? (
          <p className="pv-panel-flat bg-cream px-3 py-2 font-sans text-xs text-ink/75">
            Your role requires two-factor authentication, so it cannot be switched off here. A
            platform admin can change your role first if you genuinely need to.
          </p>
        ) : (
          <form action={disableAction} className="flex flex-wrap items-end gap-2">
            <FormBanner pending={disableStatePending} state={disableState} />
            <div className="grow">
              <label className="pv-label" htmlFor="totp-disable-password">
                Confirm your password to switch it off
              </label>
              <PasswordInput
                id="totp-disable-password"
                name="password"
                autoComplete="current-password"
                required
                className="pv-input"
              />
            </div>
            <SubmitButton variant="secondary" className="px-3 py-2" pendingLabel="Switching off…">
              Turn off
            </SubmitButton>
          </form>
        )}
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-3">
        {required ? (
          <p className="pv-panel-flat bg-yellow px-3 py-2 font-sans text-sm">
            Your role has access to other people&rsquo;s submissions and account data. Please set
            up two-factor authentication now.
          </p>
        ) : (
          <p className="font-sans text-sm text-ink/80">
            Add a second step to sign-in using any authenticator app — Google Authenticator, Aegis,
            1Password or similar.
          </p>
        )}
        {startError ? (
          <p role="alert" className="pv-panel-flat bg-pink px-3 py-2 font-sans text-sm">
            {startError}
          </p>
        ) : null}
        <button
          type="button"
          disabled={starting}
          className="pv-btn-primary self-start px-4 py-2 disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setStartError(null);
              const result = await startTotpAction();
              const next = enrollmentFrom(result);
              if (next) setEnrollment(next);
              else setStartError(result.message ?? "Could not start the setup. Try again.");
            })
          }
        >
          {starting ? "Preparing…" : "Set up two-factor authentication"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3 font-sans text-sm text-ink/85">
        <li>
          <strong>1.</strong> Scan this code with your authenticator app.
          <div className="mt-2 inline-block border-2 border-ink bg-paper p-2 shadow-hard-sm">
            <Image
              src={enrollment.qr}
              alt="Two-factor setup QR code"
              width={200}
              height={200}
              unoptimized
            />
          </div>
        </li>
        <li>
          <strong>2.</strong> Or type this key in manually:
          <code className="mt-1 block break-all font-mono text-xs">
            {enrollment.formattedSecret}
          </code>
        </li>
        <li>
          <strong>3.</strong> Enter the six-digit code the app shows.
        </li>
      </ol>
      <form action={confirmAction} className="flex flex-wrap items-end gap-2">
        <FormBanner pending={confirmStatePending} state={confirmState} />
        <div>
          <label className="pv-label" htmlFor="totp-token">
            Code from your app
          </label>
          <input
            id="totp-token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            className="pv-input w-40 font-mono tracking-[0.3em]"
          />
        </div>
        <SubmitButton className="px-4 py-2" pendingLabel="Verifying…">
          Turn on two-factor
        </SubmitButton>
      </form>
    </div>
  );
}
