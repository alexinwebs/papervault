/**
 * Pure helpers behind src/middleware.ts. Kept separate so they can be unit
 * tested without an edge-runtime request object, and so the middleware itself
 * stays a thin adapter.
 */

export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Routes authenticated by a shared secret in a header rather than by the
 * session cookie. A browser cannot be tricked into attaching a bearer token to
 * a cross-site request, so an origin check would only block legitimate
 * schedulers.
 */
export const ORIGIN_EXEMPT_PREFIXES = ["/api/cron/"];

/** Served bytes belong to uploaders, so they get the strictest policy we have. */
export const FILE_CSP = "default-src 'none'; object-src 'none'; sandbox";

export type OriginContext = {
  /** Value of the Origin header, if the browser sent one. */
  origin: string | null;
  /** Value of the Sec-Fetch-Site header, if the browser sent one. */
  secFetchSite: string | null;
  /** Host the request was addressed to, including any port. */
  host: string | null;
  /** Host a reverse proxy says the client used. */
  forwardedHost?: string | null;
  /** Scheme a reverse proxy says the client used. */
  forwardedProto?: string | null;
  /** Scheme this server saw, without the trailing colon. */
  protocol: string;
  /** Origin Next resolved for the request URL. */
  requestOrigin: string;
  /** NEXT_PUBLIC_SITE_URL, when configured. */
  siteUrl?: string | null;
};

export function allowedOrigins(ctx: OriginContext): Set<string> {
  const origins = new Set<string>();
  if (ctx.siteUrl) {
    try {
      origins.add(new URL(ctx.siteUrl).origin);
    } catch {
      /* a malformed site URL simply contributes nothing */
    }
  }
  // Behind a proxy the visible host is the forwarded one, so accept both and
  // the app works unchanged on a platform that terminates TLS for us.
  const proto = ctx.forwardedProto || ctx.protocol;
  for (const host of [ctx.forwardedHost, ctx.host]) {
    if (host) origins.add(`${proto}://${host}`);
  }
  origins.add(ctx.requestOrigin);
  return origins;
}

/**
 * Defence in depth behind Next's own server-action origin check: a mutating
 * request is only accepted when the browser says it came from this site.
 */
export function isSameOrigin(ctx: OriginContext): boolean {
  if (ctx.secFetchSite === "same-origin") return true;
  if (!ctx.origin) return false;
  return allowedOrigins(ctx).has(ctx.origin);
}

export function requiresOriginCheck(method: string, pathname: string): boolean {
  if (!UNSAFE_METHODS.has(method.toUpperCase())) return false;
  return !ORIGIN_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Content-Security-Policy for an HTML response. The nonce is what lets us drop
 * 'unsafe-inline' from script-src: Next stamps the same value onto every
 * script tag it renders, and 'strict-dynamic' lets those scripts pull their
 * own chunks without listing each one.
 */
export function contentSecurityPolicy(nonce: string, { dev = false } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and Next inject inline <style> tags with no nonce hook, so
    // styles remain the one place inline content is still allowed.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    // The paper viewer embeds PDFs served from our own /api/files route.
    "object-src 'self'",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
