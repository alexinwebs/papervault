"use client";
import { useLayoutEffect } from "react";
import { lockPageScroll } from "@/lib/scroll-lock";

export function useScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (active) return lockPageScroll();
  }, [active]);
}
