type Level = "info" | "warn" | "error";
const REDACT = /password|secret|token|authorization|cookie/i;

function scrub(meta: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : v]),
  );
}

function emit(level: Level, msg: string, meta: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...scrub(meta) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (m: string, meta?: Record<string, unknown>) => emit("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => emit("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => emit("error", m, meta),
};

export const requestId = () => crypto.randomUUID();
