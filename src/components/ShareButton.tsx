"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { safeLocalPath } from "@/lib/utils";

/** Shares only an explicit public route, never a session/token-bearing current URL. */
export function ShareButton({ path, title, label = "Share collection" }: {
  path: string; title: string; label?: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function share() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const url = new URL(safeLocalPath(path), window.location.origin).href;
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title, url });
          setMessage("Share sheet opened.");
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
          // Clipboard/manual copy remains available if native sharing is unsupported.
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied. Share it with your class.");
      } catch {
        window.prompt("Copy this public link", url);
        setMessage("Copy the link to share it with your class.");
      }
    } finally {
      setBusy(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(""), 6000);
    }
  }
  return <div className="flex min-w-0 flex-col items-start gap-1">
    <button type="button" className="pv-btn-secondary" onClick={share} disabled={busy}>
      <Share2 className="h-4 w-4" aria-hidden />{busy ? "Sharing…" : label}
    </button>
    <span role="status" className="max-w-xs text-xs text-ink/70">{message}</span>
  </div>;
}
