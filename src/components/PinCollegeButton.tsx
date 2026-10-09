"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import { setCollegePinAction } from "@/server/actions/pins";
import { cx } from "@/lib/utils";
import { PINS_CHANGED_EVENT } from "@/lib/pins-event";

/**
 * Small pin control for a college. Optimistic: the state flips immediately and
 * rolls back if the server refuses. Once the server has saved it, the page is
 * refreshed in place (router.refresh keeps the URL, filters and scroll
 * position) so the "My Colleges" list in the navigation picks up the change.
 * The refresh is deliberately not awaited: "saving" ends when the database
 * write does, so a slow or interrupted refresh can never leave the button
 * stuck or roll the visible state back.
 */
export function PinCollegeButton({
  collegeId,
  collegeName,
  pinned,
  signedIn,
  size = "md",
  className,
}: {
  collegeId: string;
  collegeName: string;
  pinned: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(pinned);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Follow the server's value whenever a refresh delivers a new one.
  useEffect(() => setOptimistic(pinned), [pinned]);

  async function onClick(event: React.MouseEvent) {
    // Cards are links; the pin must never trigger the card's navigation.
    event.preventDefault();
    event.stopPropagation();
    if (!signedIn) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (pending) return;
    const want = !optimistic;
    setError(null);
    setOptimistic(want);
    setPending(true);
    try {
      const result = await setCollegePinAction(collegeId, want);
      if (!result.ok) {
        setOptimistic(!want);
        setError(result.message ?? "Could not update the pin.");
        return;
      }
      const nav = (result.data as { nav?: unknown } | undefined)?.nav;
      if (Array.isArray(nav)) window.dispatchEvent(new CustomEvent(PINS_CHANGED_EVENT, { detail: nav }));
    } catch {
      setOptimistic(!want);
      setError("Could not update the pin. Check your connection and try again.");
      return;
    } finally {
      setPending(false);
    }
    router.refresh();
  }

  const Icon = optimistic ? PinOff : Pin;
  const label = optimistic ? `Unpin ${collegeName}` : `Pin ${collegeName}`;

  return (
    <span className={cx("inline-flex flex-col items-end", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={optimistic}
        aria-label={label}
        title={optimistic ? "Pinned — click to unpin" : "Pin to My Colleges"}
        data-testid="pin-college"
        data-pinned={optimistic ? "true" : "false"}
        // "true" until the server has saved the change and the page refreshed.
        data-saving={pending ? "true" : "false"}
        aria-busy={pending}
        disabled={pending}
        className={cx(
          "group inline-flex items-center gap-1 border-2 border-ink rounded-sm font-mono uppercase tracking-[0.08em] transition-colors disabled:opacity-70",
          size === "sm" ? "min-h-[32px] px-2 py-1 text-[10px]" : "min-h-[36px] px-3 py-1.5 text-[11px]",
          optimistic ? "bg-yellow shadow-hard-sm" : "bg-cream hover:bg-yellow/60",
        )}
      >
        {optimistic ? (
          <>
            <Pin className="h-3.5 w-3.5 fill-current group-hover:hidden" aria-hidden />
            <Icon className="hidden h-3.5 w-3.5 group-hover:block" aria-hidden />
          </>
        ) : (
          <Pin className="h-3.5 w-3.5" aria-hidden />
        )}
        <span>{optimistic ? "Pinned" : "Pin"}</span>
      </button>
      {error ? (
        <span role="alert" className="mt-1 max-w-[220px] text-right font-sans text-[11px] text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
