import * as Sentry from "@sentry/node";
import type { ErrorEvent } from "@sentry/node";

const SECRET_KEYS = /pass(word)?|secret|token|authorization|cookie|session|otp|code|email/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (typeof value === "string") return value.replace(EMAIL, "[email]");
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SECRET_KEYS.test(key) ? "[redacted]" : scrub(inner, depth + 1),
      ]),
    );
  }
  return value;
}

/** Drops credentials, cookies and email addresses before anything leaves the server. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) event.request.headers = scrub(event.request.headers) as Record<string, string>;
    if (event.request.query_string) event.request.query_string = "[redacted]";
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
  for (const crumb of event.breadcrumbs ?? []) {
    if (typeof crumb.data?.url === "string") crumb.data.url = crumb.data.url.split("?")[0];
    if (crumb.message) crumb.message = crumb.message.replace(EMAIL, "[email]");
  }
  if (event.message) event.message = event.message.replace(EMAIL, "[email]");
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = exception.value.replace(EMAIL, "[email]");
  }
  return event;
}

export function initSentry(dsn: string) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.APP_VERSION,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    beforeSend: scrubEvent,
  });
  return (error: unknown, context?: Record<string, unknown>) => {
    Sentry.captureException(error, { extra: context });
  };
}

export async function flushSentry(timeoutMs = 2_000) {
  await Sentry.flush(timeoutMs);
}
