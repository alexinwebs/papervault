"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { MouseEvent } from "react";
import { cx } from "@/lib/utils";
import { NAV_REPLACE_KEY, canGoBack, readNavStack } from "@/lib/nav-stack";

/**
 * "← Back" for deeper pages.
 * - With in-app history: behaves exactly like the browser Back button, so the
 *   previous page comes back with its query, filters, page and scroll.
 * - Landed directly (shared link, new tab, refresh after sign-in): goes to the
 *   logical parent instead, replacing the current entry so Back never loops.
 * Rendered as a real link to the parent, so it still works without JavaScript.
 */
export function BackButton({
  fallback,
  label = "Back",
  className,
}: {
  fallback: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab/window) open the parent normally.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (canGoBack(readNavStack()) && window.history.length > 1) {
      router.back();
      return;
    }
    try {
      window.sessionStorage.setItem(NAV_REPLACE_KEY, "1");
    } catch {
      // ignore
    }
    router.replace(fallback);
  }

  return (
    <Link
      href={fallback}
      onClick={onClick}
      data-testid="back-button"
      aria-label={label === "Back" ? "Go back" : label}
      className={cx(
        "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-sm border-2 border-ink bg-cream px-2.5 py-1",
        "font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink no-underline shadow-hard-sm",
        "transition-transform hover:-translate-y-[1px] hover:bg-yellow active:translate-y-0",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Link>
  );
}
