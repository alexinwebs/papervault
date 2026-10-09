"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Shows a value with a one-tap copy button (falls back to selecting the text). */
export function CopyText({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="pv-panel-flat break-all bg-paper px-3 py-2 font-mono text-sm" data-testid="upi-id">
        {value}
      </code>
      <button
        type="button"
        className="pv-btn-secondary px-3 py-1.5 text-xs"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt(`Copy ${label}`, value);
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </div>
  );
}
