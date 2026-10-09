import { logger } from "./logger";

type Reporter = (error: unknown, context?: Record<string, unknown>) => void;

// Kept on globalThis: instrumentation and each route are separate bundles, so
// a plain module variable set at boot would be invisible to request code.
const store = globalThis as typeof globalThis & { __pvErrorReporter?: Reporter | null };

/**
 * Registers an error reporter. Called once from instrumentation, which is the
 * only place that knows whether Sentry (or anything else) is configured. The
 * app itself only ever calls captureError, so swapping vendors touches one
 * file and no business logic.
 *
 * Sentry is wired in src/lib/sentry.ts and switches on when SENTRY_DSN is set.
 */
export function setErrorReporter(next: Reporter) {
  store.__pvErrorReporter = next;
}

export function hasErrorReporter() {
  return Boolean(store.__pvErrorReporter);
}

/** Logs an error and forwards it to the configured reporter, if any. */
export function captureError(error: unknown, context: Record<string, unknown> = {}) {
  logger.error("captured_error", {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
  });
  const reporter = store.__pvErrorReporter;
  if (!reporter) return;
  try {
    reporter(error, context);
  } catch (reporterError) {
    // A broken reporter must never take down the request it was reporting on.
    logger.error("error_reporter_failed", { error: String(reporterError) });
  }
}

/**
 * Times an operation and logs it as a structured span. Cheap enough to leave
 * on in production, and the shape maps straight onto an OpenTelemetry span if
 * you later add an exporter.
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    logger.info("span", { name, ...attributes, durationMs: Date.now() - startedAt, ok: true });
    return result;
  } catch (error) {
    logger.warn("span", { name, ...attributes, durationMs: Date.now() - startedAt, ok: false });
    captureError(error, { span: name, ...attributes });
    throw error;
  }
}
