"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { PdfPages } from "./PdfPages";
import { useScrollLock } from "./useScrollLock";

/** The selected file stays in this browser. No storage upload is needed to preview it. */
/* eslint-disable @next/next/no-img-element -- Local selected image; no remote optimization needed. */
export function UploadPreview({ file, onClose }: { file: File; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Uint8Array>();
  const [url, setUrl] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useScrollLock(true);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  useEffect(() => {
    let cancelled = false;
    const local = URL.createObjectURL(file); setUrl(local);
    if (isPdf) file.arrayBuffer().then((buffer) => { if (!cancelled) setData(new Uint8Array(buffer)); }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; URL.revokeObjectURL(local); };
  }, [file, isPdf]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-labelledby="upload-preview-title" onCancel={(event) => { event.preventDefault(); onClose(); }} className="m-auto w-[calc(100%-1rem)] max-w-[1100px] max-h-[calc(100dvh-1rem)] overflow-hidden open:flex open:flex-col rounded-sm border-2 border-ink bg-paper p-0 text-ink shadow-hard-lg backdrop:bg-ink/50" data-testid="upload-preview">
    <div className="flex items-center gap-3 border-b-2 border-ink bg-blue-light px-4 py-3"><h2 id="upload-preview-title" className="min-w-0 flex-1 truncate font-mono text-base font-bold">Preview: {file.name}</h2><button type="button" className="pv-btn-ghost px-2" aria-label="Close paper preview" onClick={onClose} autoFocus><X className="h-5 w-5" aria-hidden /></button></div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-3 py-2">
      {isPdf ? <div className="flex items-center gap-1"><button type="button" className="pv-btn-ghost px-2" aria-label="Previous page" disabled={page <= 1} onClick={() => { setStatus("loading"); setPage((p) => p - 1); }}><ChevronLeft className="h-4 w-4" /></button><span className="font-sans text-sm" aria-live="polite">Page {page} / {count || "…"}</span><button type="button" className="pv-btn-ghost px-2" aria-label="Next page" disabled={!count || page >= count} onClick={() => { setStatus("loading"); setPage((p) => p + 1); }}><ChevronRight className="h-4 w-4" /></button></div> : <span className="font-sans text-sm">Selected image</span>}
      <div className="flex items-center gap-1"><button type="button" className="pv-btn-ghost px-2" aria-label="Zoom out" disabled={zoom <= 50} onClick={() => { if (isPdf) setStatus("loading"); setZoom((z) => z - 25); }}><Minus className="h-4 w-4" /></button><span className="w-12 text-center font-sans text-sm">{zoom}%</span><button type="button" className="pv-btn-ghost px-2" aria-label="Zoom in" disabled={zoom >= 250} onClick={() => { if (isPdf) setStatus("loading"); setZoom((z) => z + 25); }}><Plus className="h-4 w-4" /></button></div>
    </div>
    <div className="max-h-[65dvh] min-h-0 flex-1 overflow-auto overscroll-contain bg-blue-soft/40 p-3" data-testid="upload-preview-pages">
      {status === "loading" ? <p role="status" className="pb-3 font-sans text-sm">Loading preview…</p> : null}
      {status === "error" ? <p role="alert" className="font-sans text-sm">This file could not be displayed. You can replace it or open the original.</p> : null}
      {isPdf && data && status !== "error" ? <PdfPages fileUrl="" fileData={data} pageNumber={page} onPageCount={setCount} zoom={zoom} label={`Selected PDF: ${file.name}`} onStatus={setStatus} /> : null}
      {!isPdf && url && status !== "error" ? <div style={{ width: `${zoom}%` }} className="mx-auto min-w-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt="Selected paper" className="w-full" onLoad={() => setStatus("ready")} onError={() => setStatus("error")} /></div> : null}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink px-4 py-3"><p className="font-sans text-sm text-ink/70">Check the header against your form.</p><div className="flex flex-wrap gap-2">{url ? <a href={url} target="_blank" rel="noreferrer" className="pv-btn-secondary">Open original</a> : null}<button type="button" className="pv-btn-primary" onClick={onClose}>Back to details</button></div></div>
  </dialog>;
}
