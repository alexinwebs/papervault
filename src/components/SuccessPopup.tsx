"use client";

import { useScrollLock } from "./useScrollLock";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, LoaderCircle, X } from "lucide-react";
import type { ActionState } from "@/server/actions/types";

type Notice = {
  kind: "success" | "error" | "loading";
  message: string;
  testId?: string;
  owner?: string;
  href?: string;
};
type PopupApi = {
  show: (notice: Notice) => void;
  pending: (owner: string, active: boolean, message: string) => void;
};
const PopupContext = createContext<PopupApi>({ show: () => {}, pending: () => {} });

/** Native modal: centered on desktop and phones, with backdrop and focus trapping. */
export function SuccessPopupProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useScrollLock(notice !== null);
  const show = useCallback((next: Notice) => setNotice(next), []);
  const pending = useCallback((owner: string, active: boolean, message: string) => {
    setNotice((current) => active
      ? { kind: "loading", owner, message }
      : current?.kind === "loading" && current.owner === owner ? null : current);
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (notice && node && !node.open) node.showModal();
    if (!notice && node?.open) node.close();
  }, [notice]);
  const loading = notice?.kind === "loading";
  const title = loading ? "Please wait" : notice?.kind === "error" ? "Could not complete" : "Completed";
  const Icon = loading ? LoaderCircle : notice?.kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <PopupContext.Provider value={{ show, pending }}>
      {children}
      <dialog ref={dialog} aria-labelledby="action-popup-title" aria-describedby="action-popup-message"
        onCancel={(event) => { event.preventDefault(); if (!loading) setNotice(null); }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-sm border-2 border-ink bg-paper p-0 text-ink shadow-hard-lg backdrop:bg-ink/50">
        {notice ? (
          <div data-testid={notice.testId ?? `${notice.kind}-popup`}>
            <div className={`flex items-center gap-3 border-b-2 border-ink px-5 py-4 ${loading ? "bg-blue-light" : notice.kind === "error" ? "bg-pink" : "bg-mint"}`}>
              <Icon className={`h-6 w-6 shrink-0 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
              <h2 id="action-popup-title" className="flex-1 font-mono text-lg font-bold">{title}</h2>
              {!loading ? <button type="button" autoFocus aria-label="Dismiss confirmation" className="pv-btn-ghost p-2" onClick={() => setNotice(null)}><X className="h-5 w-5" aria-hidden /></button> : null}
            </div>
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <p id="action-popup-message" role={notice.kind === "error" ? "alert" : "status"} aria-live={notice.kind === "error" ? "assertive" : "polite"} className="break-words font-sans text-sm leading-relaxed">{notice.message}</p>
              {loading ? <p className="font-sans text-xs text-ink/70">Keep this page open while we finish. This can take a moment.</p> : (
                <div className="flex flex-wrap justify-end gap-3">
                  {notice.href ? <Link href={notice.href} className="pv-btn-secondary" onClick={() => setNotice(null)}>View your upload →</Link> : null}
                  <button type="button" className="pv-btn-primary" onClick={() => setNotice(null)}>{notice.kind === "error" ? "Go back and fix" : "Done"}</button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </PopupContext.Provider>
  );
}

export function useNotifySuccess() {
  const { show } = useContext(PopupContext);
  return useCallback((message: string, testId?: string) => show({ kind: "success", message, testId }), [show]);
}

export function usePendingPopup(active: boolean, message: string) {
  const { pending } = useContext(PopupContext);
  const owner = useId();
  useEffect(() => {
    if (!active) return;
    pending(owner, true, message);
    return () => pending(owner, false, message);
  }, [active, message, owner, pending]);
}

export function SuccessPopup({ message, testId }: { message?: string; testId?: string }) {
  const show = useNotifySuccess();
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (message && shown.current !== message) {
      shown.current = message;
      show(message, testId);
    }
  }, [message, testId, show]);
  return null;
}

function useResultPopup(state: ActionState, errors: boolean, active: boolean, loadingMessage: string) {
  usePendingPopup(active, loadingMessage);
  const { show } = useContext(PopupContext);
  const shown = useRef<ActionState | null>(null);
  useEffect(() => {
    const message = state.message ?? (state.fieldErrors && Object.keys(state.fieldErrors).length ? "Please check the highlighted fields and try again." : undefined);
    if (!active && message && (state.ok || errors) && shown.current !== state) {
      shown.current = state;
      show({ kind: state.ok ? "success" : "error", message,
        href: state.ok && typeof state.data?.paperId === "string" ? `/papers/${state.data.paperId}` : undefined });
    }
  }, [state, show, errors, active]);
}

export function useSuccessPopup(state: ActionState, pending = false) { useResultPopup(state, false, pending, "Working…"); }
export function useActionPopup(state: ActionState, pending = false, message = "Working…") { useResultPopup(state, true, pending, message); }
