/**
 * Runs once when the server boots. Validates configuration before the app
 * accepts traffic, and is the hook point for Sentry/OpenTelemetry setup.
 */
export async function register() {
  // The literal comparison lets the bundler drop Node-only code from the edge build.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}

/**
 * Next.js calls this for uncaught errors in server components, route handlers
 * and server actions, which is the single best place to fan out to a reporter.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string },
) {
  const { captureError } = await import("./lib/observability");
  captureError(error, {
    // Query strings can carry search terms and tokens; keep only the path.
    path: request.path?.split("?")[0],
    method: request.method,
    routePath: context.routePath,
    renderSource: context.renderSource,
  });
}
