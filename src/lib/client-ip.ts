/**
 * Client address for rate limiting and the session device list.
 *
 * X-Forwarded-For is a list that every proxy appends to, so the left-most
 * entries are whatever the client chose to send. Only the entries added by
 * our own proxies can be trusted: with TRUSTED_PROXY_HOPS=N we take the Nth
 * entry from the right. The production compose file puts exactly one proxy
 * (Caddy) in front of the app, which is the default. Set 0 when the app is
 * reached directly, in which case forwarding headers are ignored entirely.
 */
const IP_SHAPE = /^[0-9A-Fa-f:.]{2,45}$/;

export function trustedProxyHops(env: Record<string, string | undefined> = process.env) {
  const raw = env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 1;
}

export function clientIpFrom(
  forwardedFor: string | null | undefined,
  realIp: string | null | undefined,
  hops = trustedProxyHops(),
): string | null {
  if (hops === 0) return null;
  const chain = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // Fewer entries than trusted hops means the header did not come through the
  // expected proxy chain; fall back to X-Real-IP, which our proxy overwrites.
  const candidate = chain.length >= hops ? chain[chain.length - hops] : (realIp ?? "").trim();
  return candidate && IP_SHAPE.test(candidate) ? candidate : null;
}

export async function clientIp(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return clientIpFrom(h.get("x-forwarded-for"), h.get("x-real-ip"));
  } catch {
    return null;
  }
}
