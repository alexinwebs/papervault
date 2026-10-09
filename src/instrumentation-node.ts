/** Node-only boot work, kept out of the edge bundle. */
export async function registerNode() {

  const { assertEnvironment } = await import("./lib/env");
  assertEnvironment();

  const { setErrorReporter } = await import("./lib/observability");
  const { logger } = await import("./lib/logger");

  if (process.env.SENTRY_DSN) {
    const { initSentry } = await import("./lib/sentry");
    setErrorReporter(initSentry(process.env.SENTRY_DSN));
    logger.info("sentry_initialised");
  }
}
