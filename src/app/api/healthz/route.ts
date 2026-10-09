import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimiterBackend } from "@/lib/rate-limit";
import { pingScanner, scannerBackend } from "@/lib/scanner";
import { storage } from "@/lib/storage";
import { hasErrorReporter } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Liveness plus dependency readiness. Returns 503 when a dependency the app
 * cannot serve without is down, so a load balancer can pull the instance.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: "up" | "down" = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  const [storageUp, scannerUp] = await Promise.all([
    storage().ping?.().catch(() => false) ?? Promise.resolve(true),
    pingScanner(),
  ]);
  // Uploads fail closed without storage or the scanner, but browsing still
  // works, so these degrade the status without taking the instance out.
  const healthy = database === "up" && storageUp && scannerUp;

  const body = {
    status: healthy ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database,
      storage: storageUp ? "up" : "down",
      rateLimiter: rateLimiterBackend(),
      malwareScanner: scannerBackend() === "clamav" ? (scannerUp ? "up" : "down") : "off",
      errorReporting: hasErrorReporter() ? "on" : "off",
    },
    latencyMs: Date.now() - startedAt,
    version: process.env.APP_VERSION ?? "dev",
  };

  return NextResponse.json(body, {
    status: database === "up" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
