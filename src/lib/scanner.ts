import { Socket } from "node:net";
import { AppError } from "./errors";
import { logger } from "./logger";

export type ScanResult = { clean: boolean; signature?: string; engine: string };

/**
 * Pluggable malware scan for uploads.
 *
 * MALWARE_SCANNER=clamav talks INSTREAM to a clamd daemon (CLAMAV_HOST /
 * CLAMAV_PORT). Anything else disables scanning, which is fine for local
 * development but should never be the setting in production — see the README.
 */
export async function scanUpload(bytes: Buffer): Promise<ScanResult> {
  const engine = (process.env.MALWARE_SCANNER ?? "none").toLowerCase();
  if (engine !== "clamav") return { clean: true, engine: "none" };

  const host = process.env.CLAMAV_HOST ?? "127.0.0.1";
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS ?? 15_000);

  const reply = await new Promise<string>((resolve, reject) => {
    const socket = new Socket();
    const chunks: Buffer[] = [];
    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => socket.destroy(new Error("clamd timed out")));
    socket.on("error", reject);
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("close", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim()));
    socket.connect(port, host, () => {
      socket.write("zINSTREAM\0");
      // INSTREAM frames: 4-byte big-endian length, then the chunk, then a zero.
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, offset + 64 * 1024);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(chunk.length, 0);
        socket.write(header);
        socket.write(chunk);
      }
      socket.write(Buffer.from([0, 0, 0, 0]));
    });
  }).catch((err) => {
    // Fail closed: an unscanned file is never stored.
    throw scannerDown(String(err));
  });

  if (!reply) throw scannerDown("empty reply");
  if (/\bOK\b/.test(reply) && !/FOUND/.test(reply)) return { clean: true, engine: "clamav" };
  const signature = reply.replace(/\0/g, "").trim().replace(/^stream:\s*/i, "").replace(/\s*FOUND$/i, "");
  logger.error("malware_detected", { signature });
  return { clean: false, signature, engine: "clamav" };
}

function scannerDown(reason: string) {
  logger.error("malware_scanner_unavailable", { reason });
  return new AppError(
    "STORAGE_ERROR",
    "Uploads are paused while the file scanner is unavailable. Please try again in a few minutes.",
  );
}

export function assertClean(result: ScanResult) {
  if (result.clean) return;
  throw new AppError(
    "VALIDATION_ERROR",
    "That file was rejected by the malware scanner. If you believe this is wrong, contact a moderator.",
  );
}

/** Which scanner the current configuration will use. Surfaced by /api/healthz. */
export function scannerBackend(): "clamav" | "none" {
  return process.env.MALWARE_SCANNER === "clamav" ? "clamav" : "none";
}

/** clamd PING/PONG probe for /api/healthz. Resolves false rather than throwing. */
export function pingScanner(timeoutMs = 2_000): Promise<boolean> {
  if (scannerBackend() !== "clamav") return Promise.resolve(true);
  const host = process.env.CLAMAV_HOST ?? "127.0.0.1";
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  return new Promise((resolve) => {
    const socket = new Socket();
    let reply = "";
    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => socket.destroy());
    socket.on("error", () => resolve(false));
    socket.on("data", (chunk) => (reply += chunk.toString("utf8")));
    socket.on("close", () => resolve(reply.includes("PONG")));
    socket.connect(port, host, () => socket.write("zPING\0"));
  });
}
