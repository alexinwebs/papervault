import { toPublicError } from "@/lib/errors";
import { captureError } from "@/lib/observability";

export type ActionState = {
  ok: boolean;
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
};

async function currentRequestId() {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}

export const idle: ActionState = { ok: false };

/**
 * Next.js signals redirect() and notFound() by throwing a tagged error, so
 * those must pass through untouched.
 */
function isFrameworkControlFlow(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

/** Wraps an action so clients only ever see safe, categorised errors. */
export async function run(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    if (isFrameworkControlFlow(err)) throw err;
    const pub = toPublicError(err);
    // Unexpected failures go to the error reporter (Sentry when configured),
    // not just the log, so a broken action is noticed.
    if (pub.code === "INTERNAL_ERROR") {
      captureError(err, { where: "server_action", requestId: await currentRequestId() });
    }
    return { ok: false, code: pub.code, message: pub.message };
  }
}

export function zodErrors(error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
