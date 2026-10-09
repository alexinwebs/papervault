import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { generateSecret, generateURI } from "otplib";
import { generate, verify } from "@otplib/totp";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import QRCode from "qrcode";

// otplib v13 is plugin-based: the algorithm core carries no crypto or base32
// implementation of its own, so every call passes the same pair.
const plugins = { crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() };

/**
 * Tolerance in seconds either side of now. Phone clocks drift and a user
 * typing six digits often crosses a 30-second boundary mid-entry, so one full
 * time step of slack is the usual 2FA trade-off.
 */
const EPOCH_TOLERANCE = 30;

export const RECOVERY_CODE_COUNT = 10;

export function newTotpSecret() {
  return generateSecret({ base32: plugins.base32 });
}

export function totpUri(secret: string, accountName: string, issuer = "PaperVault") {
  return generateURI({ strategy: "totp", issuer, label: accountName, secret });
}

export function totpQrDataUrl(uri: string) {
  return QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}

/** Current code for a secret. Used by tests and the enrolment preview. */
export function currentTotp(secret: string) {
  return generate({ ...plugins, secret });
}

export async function verifyTotp(token: string, secret: string) {
  const cleaned = token.replace(/\D/g, "");
  if (cleaned.length !== 6) return false;
  try {
    const result = await verify({ ...plugins, secret, token: cleaned, epochTolerance: EPOCH_TOLERANCE });
    return result.valid;
  } catch {
    return false;
  }
}

/** Human-typeable one-time codes for a lost authenticator app. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from(
    { length: count },
    () => randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
  );
}

export function normalizeRecoveryCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Constant-time comparison so stored hashes cannot be probed by timing. */
export function recoveryHashMatches(candidate: string, stored: string) {
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A secret shown to the user in readable groups of four. */
export function formatSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
