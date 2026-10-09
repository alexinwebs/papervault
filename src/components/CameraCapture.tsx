"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Trash2, X, ArrowLeft, ArrowRight, Check } from "lucide-react";

export type CapturedPage = { id: string; dataUrl: string };

const MAX_PAGES = 30;
const MAX_EDGE = 2200; // keeps a full page legible without producing huge files

/** Draws the current video frame to a canvas and returns a compressed JPEG. */
function frameToJpeg(video: HTMLVideoElement): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * In-browser page scanner. Captures one or more photos from the device camera
 * and hands them to the upload form, which turns them into a single PDF on the
 * server. Falls back gracefully when the browser blocks camera access.
 */
export function CameraCapture({
  pages,
  onChange,
  disabled,
}: {
  pages: CapturedPage[];
  onChange: (pages: CapturedPage[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser will not open the camera here. Use “Choose a file” and your phone's camera app instead.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setReady(true);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setError(
        name === "NotAllowedError"
          ? "Camera permission was blocked. Allow it in your browser settings, or use “Choose a file”."
          : name === "NotFoundError"
            ? "No camera was found on this device. Use “Choose a file” instead."
            : "The camera could not be started. Use “Choose a file” instead.",
      );
    }
  }, [facing]);

  // Camera access requires a secure context; localhost counts as secure.
  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    void start();
    return stop;
  }, [open, start, stop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shoot = () => {
    if (!videoRef.current || pages.length >= MAX_PAGES) return;
    const dataUrl = frameToJpeg(videoRef.current);
    if (!dataUrl) return;
    onChange([...pages, { id: `${Date.now()}-${pages.length}`, dataUrl }]);
  };

  const move = (index: number, delta: number) => {
    const next = [...pages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="pv-btn-secondary px-3 py-2 text-xs"
        >
          <Camera className="h-4 w-4" aria-hidden /> Open camera
        </button>
        {pages.length > 0 ? (
          <span className="font-mono text-[11px] text-ink/70">
            {pages.length} page{pages.length === 1 ? "" : "s"} captured — they become one PDF.
          </span>
        ) : (
          <span className="font-sans text-[11px] text-ink/60">
            Photograph each page; PaperVault stitches them into a single PDF.
          </span>
        )}
      </div>

      {error && !open ? (
        <p role="status" className="pv-panel-flat bg-yellow px-3 py-2 font-sans text-[11px]">
          {error}
        </p>
      ) : null}

      {pages.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {pages.map((page, index) => (
            <li key={page.id} className="pv-panel-flat overflow-hidden p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.dataUrl}
                alt={`Captured page ${index + 1}`}
                className="h-28 w-full border border-ink/20 object-cover"
              />
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="font-mono text-[10px]">#{index + 1}</span>
                <span className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    aria-label={`Move page ${index + 1} earlier`}
                    className="pv-btn-ghost px-1 py-0.5"
                  >
                    <ArrowLeft className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    aria-label={`Move page ${index + 1} later`}
                    className="pv-btn-ghost px-1 py-0.5"
                  >
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(pages.filter((p) => p.id !== page.id))}
                    aria-label={`Remove page ${index + 1}`}
                    className="pv-btn-ghost px-1 py-0.5"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera"
          className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-3"
        >
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 pb-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-cream">
              Capture pages ({pages.length}/{MAX_PAGES})
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-2 border-cream bg-cream px-3 py-1 font-mono text-xs"
            >
              <X className="h-4 w-4" aria-hidden /> Close
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center overflow-hidden border-2 border-cream bg-black">
            {error ? (
              <p className="p-6 text-center font-mono text-xs text-cream">{error}</p>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="max-h-full max-w-full"
                aria-label="Camera preview"
              />
            )}
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 pt-3">
            <button
              type="button"
              onClick={shoot}
              disabled={!ready || pages.length >= MAX_PAGES}
              className="border-2 border-ink bg-cream px-5 py-2 font-mono text-sm shadow-hard-sm disabled:opacity-50"
            >
              <Camera className="h-4 w-4" aria-hidden /> Capture page
            </button>
            <button
              type="button"
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              className="border-2 border-cream bg-transparent px-3 py-2 font-mono text-xs text-cream"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Flip camera
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pages.length === 0}
              className="border-2 border-ink bg-mint px-4 py-2 font-mono text-sm shadow-hard-sm disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden /> Done ({pages.length})
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
