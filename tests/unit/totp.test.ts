import { describe, expect, it } from "vitest";
import {
  currentTotp,
  formatSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  newTotpSecret,
  normalizeRecoveryCode,
  recoveryHashMatches,
  totpUri,
  verifyTotp,
} from "@/lib/totp";

describe("totp", () => {
  it("round-trips a freshly generated code", async () => {
    const secret = newTotpSecret();
    const code = await currentTotp(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(await verifyTotp(code, secret)).toBe(true);
  });

  it("rejects a wrong code and a code from another secret", async () => {
    const secret = newTotpSecret();
    const other = newTotpSecret();
    expect(await verifyTotp("000000", secret)).toBe(false);
    expect(await verifyTotp(await currentTotp(other), secret)).toBe(false);
  });

  it("ignores spacing and rejects anything that is not six digits", async () => {
    const secret = newTotpSecret();
    const code = await currentTotp(secret);
    expect(await verifyTotp(`${code.slice(0, 3)} ${code.slice(3)}`, secret)).toBe(true);
    expect(await verifyTotp("12345", secret)).toBe(false);
    expect(await verifyTotp("abcdef", secret)).toBe(false);
  });

  it("builds an otpauth URI an authenticator app can read", () => {
    const uri = totpUri("JBSWY3DPEHPK3PXP", "admin@papervault.dev");
    expect(uri.startsWith("otpauth://totp/PaperVault:")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=PaperVault");
  });

  it("formats a secret in readable groups", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});

describe("recovery codes", () => {
  it("issues distinct codes", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
  });

  it("matches regardless of how the user types it", () => {
    const [code] = generateRecoveryCodes(1);
    const stored = hashRecoveryCode(code);
    expect(recoveryHashMatches(hashRecoveryCode(code.toLowerCase()), stored)).toBe(true);
    expect(recoveryHashMatches(hashRecoveryCode(code.replace("-", " ")), stored)).toBe(true);
    expect(normalizeRecoveryCode(code)).toBe(code.replace("-", ""));
  });

  it("does not match a different code", () => {
    const [a, b] = generateRecoveryCodes(2);
    expect(recoveryHashMatches(hashRecoveryCode(a), hashRecoveryCode(b))).toBe(false);
  });
});
