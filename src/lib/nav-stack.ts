/**
 * Per-tab in-app navigation stack used by the Back button.
 *
 * The browser's own history is the source of truth for *where* Back goes
 * (we call router.back()), but the History API does not tell us whether the
 * previous entry belongs to PaperVault. This stack mirrors in-app navigation
 * in sessionStorage so the Back button can decide between "go back" and
 * "go to the parent page" without ever leaving the site or looping.
 */
export const NAV_STACK_KEY = "pv:navstack";
export const NAV_REPLACE_KEY = "pv:nav-replace";
export const NAV_STACK_MAX = 50;

/** Pages we never send someone "back" into (forms that already completed). */
const AUTH_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/reset-password",
  "/forgot-password",
];

export function isAuthPath(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Pure reducer: given the current stack and the URL just navigated to,
 * return the next stack.
 *  - replace: swap the top entry (router.replace / fallback navigation)
 *  - same URL as top: no-op (refresh, router.refresh, hash changes)
 *  - same URL as the entry below the top: treat as a back step (pop)
 *  - otherwise: push
 */
export function nextNavStack(stack: string[], url: string, replace = false): string[] {
  if (stack.length === 0) return [url];
  const top = stack[stack.length - 1];
  if (replace) return [...stack.slice(0, -1), url];
  if (top === url) return stack;
  if (stack.length >= 2 && stack[stack.length - 2] === url) return stack.slice(0, -1);
  const next = [...stack, url];
  return next.length > NAV_STACK_MAX ? next.slice(next.length - NAV_STACK_MAX) : next;
}

/** True when history-based Back would land on a safe in-app page. */
export function canGoBack(stack: string[]): boolean {
  if (stack.length < 2) return false;
  return !isAuthPath(stack[stack.length - 2]);
}

export function readNavStack(): string[] {
  try {
    const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function writeNavStack(stack: string[]): void {
  try {
    window.sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  } catch {
    // Storage unavailable (private mode quotas): Back falls back to parents.
  }
}
