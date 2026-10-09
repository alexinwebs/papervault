"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_REPLACE_KEY, nextNavStack, readNavStack, writeNavStack } from "@/lib/nav-stack";

/** Records in-app navigation (path + query) so BackButton can decide safely. */
export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const first = useRef(true);
  const search = searchParams.toString();

  useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    let stack = readNavStack();
    if (first.current) {
      first.current = false;
      // A fresh tab (or a tab opened from a link) has no in-app history even
      // if sessionStorage was cloned from the opener.
      if (window.history.length <= 1) stack = [];
    }
    let replace = false;
    try {
      replace = window.sessionStorage.getItem(NAV_REPLACE_KEY) === "1";
      if (replace) window.sessionStorage.removeItem(NAV_REPLACE_KEY);
    } catch {
      replace = false;
    }
    writeNavStack(nextNavStack(stack, url, replace));
  }, [pathname, search]);

  return null;
}
