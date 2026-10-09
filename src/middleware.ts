import { NextResponse, type NextRequest } from "next/server";
import { configuredSiteUrl } from "@/lib/site";
import {
  FILE_CSP,
  contentSecurityPolicy,
  isSameOrigin,
  requiresOriginCheck,
} from "@/lib/security";

/**
 * Edge middleware carrying the two protections that have to run before any
 * route code: a same-origin check on state-changing requests, and a
 * per-request Content-Security-Policy nonce.
 *
 * The decision logic lives in src/lib/security.ts so it can be unit tested;
 * keep this file a thin, dependency-free adapter because it runs on every
 * request.
 */

function nonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Keeps a sane upstream id (e.g. from the proxy) or mints one. */
function requestId(incoming: string | null) {
  return incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const id = requestId(request.headers.get("x-request-id"));

  if (requiresOriginCheck(request.method, pathname)) {
    const ok = isSameOrigin({
      origin: request.headers.get("origin"),
      secFetchSite: request.headers.get("sec-fetch-site"),
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
      protocol: request.nextUrl.protocol.replace(":", ""),
      requestOrigin: request.nextUrl.origin,
      siteUrl: configuredSiteUrl() || undefined,
    });
    if (!ok) {
      return new NextResponse("Cross-origin request blocked.", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8", "x-request-id": id },
      });
    }
  }

  // Every route that streams user-uploaded bytes gets the locked-down file policy.
  const isFile =
    pathname.startsWith("/api/files/") ||
    pathname.startsWith("/api/admin/teacher-verifications/documents/") ||
    pathname.startsWith("/api/tickets/attachments/");
  const csp = isFile
    ? FILE_CSP
    : contentSecurityPolicy(nonce(), { dev: process.env.NODE_ENV !== "production" });

  // Next reads the nonce back out of the request header and stamps it onto the
  // scripts it renders, which is what makes 'unsafe-inline' unnecessary.
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", csp);
  headers.set("x-request-id", id);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set("x-permitted-cross-domain-policies", "none");
  // Correlates a user's error report with server logs and Sentry events.
  response.headers.set("x-request-id", id);
  if (isFile) response.headers.set("cross-origin-resource-policy", "same-origin");
  return response;
}

export const config = {
  // Static assets and image optimisation output need no policy of their own.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
