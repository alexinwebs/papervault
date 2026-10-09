import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";

export const TOKEN_TYPES = ["EMAIL_VERIFY", "PASSWORD_RESET"] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

const TTL_MS: Record<TokenType, number> = {
  EMAIL_VERIFY: 1000 * 60 * 60 * 24, // 24 hours
  PASSWORD_RESET: 1000 * 60 * 30, // 30 minutes
};

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

/**
 * Issues a single-use token. Only the SHA-256 digest is stored, so a database
 * leak cannot be replayed against the account.
 */
export async function issueToken(userId: string, type: TokenType) {
  // Any outstanding token of the same kind is spent, so the newest link wins.
  await prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  const raw = randomBytes(32).toString("base64url");
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + TTL_MS[type]),
    },
  });
  return raw;
}

/** Returns the userId when the token is valid, and burns it. */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  if (!raw) return null;
  const digest = hash(raw);
  const record = await prisma.authToken.findUnique({ where: { tokenHash: digest } });
  if (!record || record.type !== type) return null;
  if (record.usedAt || record.expiresAt < new Date()) return null;
  // Constant-time compare on the digest, belt and braces against oracles.
  const a = Buffer.from(record.tokenHash);
  const b = Buffer.from(digest);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const spent = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  // A second concurrent request finds nothing left to spend.
  if (spent.count !== 1) return null;
  return record.userId;
}

export async function purgeExpiredTokens() {
  const { count } = await prisma.authToken.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - TTL_MS.EMAIL_VERIFY) } },
  });
  return count;
}
