"use client";

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
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  pendingLabel?: string;
  /** Stable hook for end-to-end tests when the label changes while pending. */
  testId?: string;
  /** Blocks an action that is never valid, e.g. banning your own account. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
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

export function FormBanner({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={cx(
        "pv-panel-flat px-3 py-2 font-mono text-xs",
        state.ok ? "bg-mint" : "bg-pink",
      )}
    >
      {state.message}
    </p>
  );
}

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 font-sans text-[11px] text-red-700">{error}</p>;
}
