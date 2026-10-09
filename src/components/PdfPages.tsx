"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draws every page of a PDF onto canvases with pdf.js. Phones (Android Chrome
 * in particular) have no inline PDF viewer, so <object>/<iframe> embeds show
 * nothing there; rendering ourselves works the same on every device.
 *
 * The worker and standard fonts are served from /public/pdfjs so nothing is
 * fetched from a CDN and the Content-Security-Policy stays 'self'-only.
 */
const MAX_PAGES = 60;

type Props = {
  fileUrl: string;
  zoom: number;
  label: string;
  onStatus: (status: "ready" | "error") => void;
};

export function PdfPages({ fileUrl, zoom, label, onStatus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const docRef = useRef<any>(null);

  // Track the available width so pages fit the screen at 100%.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load the document once per file.
  useEffect(() => {
    let cancelled = false;
    let task: any = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        task = pdfjs.getDocument({
          url: fileUrl,
          withCredentials: true,
          isEvalSupported: false,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
        });
        const doc = await task.promise;
        if (cancelled) return;
        docRef.current = doc;
        setPageCount(Math.min(doc.numPages, MAX_PAGES));
      } catch {
        if (!cancelled) onStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy?.();
      docRef.current = null;
    };
    // onStatus is a stable state setter wrapper; reload only for a new file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // (Re)draw pages whenever the size or zoom changes.
  useEffect(() => {
    const doc = docRef.current;
    const el = containerRef.current;
    if (!doc || !el || !width || !pageCount) return;
    let cancelled = false;
    const renders: any[] = [];
    (async () => {
      try {
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        const canvases = el.querySelectorAll<HTMLCanvasElement>("canvas[data-page]");
        for (let i = 0; i < canvases.length && !cancelled; i++) {
          const page = await doc.getPage(i + 1);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const cssWidth = (width * zoom) / 100;
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
          const canvas = canvases[i];
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(cssWidth)}px`;
          canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
          const task = page.render({ canvasContext: canvas.getContext("2d")!, viewport });
          renders.push(task);
          await task.promise;
          if (i === 0 && !cancelled) onStatus("ready");
        }
      } catch (error) {
        if (!cancelled && (error as Error)?.name !== "RenderingCancelledException") onStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      renders.forEach((t) => t.cancel?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, zoom, pageCount]);

  return (
    <div ref={containerRef} className="w-full" aria-label={label} role="document" data-testid="pdf-pages">
      <div className="flex w-max min-w-full flex-col items-center gap-3">
        {Array.from({ length: pageCount }, (_, i) => (
          <canvas
            key={i}
            data-page={i + 1}
            className="max-w-none border-2 border-ink bg-white"
            aria-label={`Page ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
