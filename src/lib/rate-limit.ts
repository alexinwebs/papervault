import { AppError } from "./errors";
import { logger } from "./logger";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Fixed-window counter held in this process. Correct for a single instance. */
function memoryHit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  bucket.count += 1;
  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
  return bucket.count;
}

type RedisLike = {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<unknown>;
};

let redis: RedisLike | null | undefined;

/**
 * Shared counter for multi-instance deployments. Set REDIS_URL to enable;
 * without it the limiter silently falls back to the in-process window, which
 * is fine for a single container but not behind a load balancer.
 */
function client(): RedisLike | null {
  if (redis !== undefined) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    redis = null;
    return redis;
  }
  try {
    // Loaded lazily so the dependency is optional at runtime.

    const { Redis } = require("ioredis") as typeof import("ioredis");
    const instance = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    instance.on("error", (err: Error) => logger.error("redis_error", { error: err.message }));
    redis = instance as unknown as RedisLike;
  } catch (err) {
    logger.error("redis_init_failed", { error: String(err) });
    redis = null;
  }
  return redis;
}

export function rateLimiterBackend() {
  return process.env.REDIS_URL ? "redis" : "memory";
}

function exceeded(): never {
  throw new AppError("RATE_LIMITED", "Too many attempts. Try again in a moment.");
}

/** Synchronous limiter kept for call sites that cannot await. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  if (memoryHit(key, limit, windowMs) > limit) exceeded();
}

/**
 * Preferred limiter: uses Redis when configured so the window is shared across
 * instances, and always applies the local window as a second line of defence.
 */
export async function rateLimitAsync(key: string, limit: number, windowMs: number) {
  if (memoryHit(key, limit, windowMs) > limit) exceeded();
  const store = client();
  if (!store) return;
  try {
    const namespaced = `pv:rl:${key}`;
    const count = await store.incr(namespaced);
    if (count === 1) await store.pexpire(namespaced, windowMs);
    if (count > limit) exceeded();
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("rate_limit_backend_failed", { error: String(err) });
  }
}
