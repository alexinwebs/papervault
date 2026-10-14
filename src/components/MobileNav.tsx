"use client";

import { useScrollLock } from "./useScrollLock";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SidebarNav, type PinnedNavCollege } from "./Sidebar";
import { LogoMark } from "./Brand";
import type { Role } from "@/lib/constants";

/** Accessible slide-in navigation for phones and small tablets. */
export function MobileNav({
  role,
  unread = 0,
  pinned = [],
  coffee = false,
}: {
  role?: Role;
  unread?: number;
  pinned?: PinnedNavCollege[];
  coffee?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useScrollLock(open);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="pv-btn-secondary px-2 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy/50"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[min(86vw,300px)] flex-col overflow-y-auto overscroll-contain border-r-2 border-ink bg-blue-light px-4 py-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LogoMark size={34} />
                <span className="font-mono text-lg font-bold leading-none">PAPER/VAULT</span>
              </span>
              <button
                type="button"
                className="pv-btn-secondary px-2"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <SidebarNav role={role} unread={unread} pinned={pinned} coffee={coffee} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
