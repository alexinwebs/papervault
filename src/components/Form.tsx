"use client";

import { useActionPopup } from "./SuccessPopup";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/actions/types";
import { cx } from "@/lib/utils";

export function SubmitButton({
  children,
  variant = "primary",
  className,
  pendingLabel = "Working…",
  testId,
  disabled = false,
  pendingOverride = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  pendingLabel?: string;
  /** Stable hook for end-to-end tests when the label changes while pending. */
  testId?: string;
  /** Blocks an action that is never valid, e.g. banning your own account. */
  disabled?: boolean;
  pendingOverride?: boolean;
}) {
  const { pending: formPending } = useFormStatus();
  const pending = formPending || pendingOverride;
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      data-testid={testId}
      className={cx(variant === "primary" ? "pv-btn-primary" : "pv-btn-secondary", className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormBanner({ state, pending = false, loadingMessage = "Working…" }: { state: ActionState; pending?: boolean; loadingMessage?: string }) {
  useActionPopup(state, pending, loadingMessage);
  return null;
}

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 font-sans text-[11px] text-red-700">{error}</p>;
}
