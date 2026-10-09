"use client";

import { useEffect, useState } from "react";
import { Download, Maximize2, Minus, Plus, RotateCw } from "lucide-react";
import { PdfPages } from "./PdfPages";

/**
 * Inline viewer for PDFs and scanned images, so a student never has to
 * download a file just to inspect it.
 */
export function PaperViewer({
  fileUrl,
  mimeType,
  downloadUrl,
  fileName,
}: {
  fileUrl: string;
  mimeType: string;
  downloadUrl: string;
  fileName: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const isPdf = mimeType === "application/pdf";

  // Images can fail silently on some browsers; never leave the overlay forever.
  useEffect(() => {
    if (status !== "loading" || isPdf) return;
    const timer = window.setTimeout(() => setStatus("ready"), 4_000);
    return () => window.clearTimeout(timer);
  }, [status, isPdf]);

  return (
    <div className="pv-panel-flat overflow-hidden bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink bg-cream px-3 py-2">
        <span className="truncate font-mono text-[11px] uppercase tracking-[0.1em]">{fileName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="pv-btn-ghost px-2"
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span className="w-12 text-center font-mono text-xs">{zoom}%</span>
          <button
            type="button"
            className="pv-btn-ghost px-2"
            onClick={() => setZoom((z) => Math.min(250, z + 25))}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="pv-btn-ghost px-2"
            onClick={() => setZoom(100)}
            aria-label="Reset zoom"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
          </button>
          <a href={fileUrl} target="_blank" rel="noreferrer" className="pv-btn-ghost px-2" aria-label="Open fullscreen">
            <Maximize2 className="h-4 w-4" aria-hidden />
          </a>
          <a href={downloadUrl} className="pv-btn-secondary" download>
            <Download className="h-4 w-4" aria-hidden /> Download
          </a>
        </div>
      </div>

      <div className="relative max-h-[70vh] overflow-auto bg-blue-soft/40 p-3">
        {status === "loading" ? (
          <p className="absolute inset-x-0 top-1/2 text-center font-mono text-xs text-ink/60">
            Loading paper…
          </p>
        ) : null}
        {status === "error" ? (
          <p className="py-16 text-center font-mono text-xs">
            This file could not be displayed.{" "}
            <a className="pv-link" href={downloadUrl}>
              Download it instead
            </a>
            .
          </p>
        ) : null}
        {isPdf ? (
          status === "error" ? null : (
            <PdfPages fileUrl={fileUrl} zoom={zoom} label={`Preview of ${fileName}`} onStatus={setStatus} />
          )
        ) : (
          <div style={{ width: `${zoom}%` }} className="mx-auto min-w-[280px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt={`Scanned paper: ${fileName}`}
              className="w-full border-2 border-ink bg-white"
              onLoad={() => setStatus("ready")}
              onError={() => setStatus("error")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
