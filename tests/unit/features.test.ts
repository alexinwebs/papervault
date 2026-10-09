import { afterEach, describe, expect, it } from "vitest";
import { donationConfig, teacherVerificationEnabled, upiLink } from "@/lib/features";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("teacher verification switch", () => {
  it("is on unless explicitly set to false", () => {
    delete process.env.TEACHER_VERIFICATION_ENABLED;
    expect(teacherVerificationEnabled()).toBe(true);
    process.env.TEACHER_VERIFICATION_ENABLED = "false";
    expect(teacherVerificationEnabled()).toBe(false);
    process.env.TEACHER_VERIFICATION_ENABLED = " FALSE ";
    expect(teacherVerificationEnabled()).toBe(false);
    process.env.TEACHER_VERIFICATION_ENABLED = "true";
    expect(teacherVerificationEnabled()).toBe(true);
  });
});

describe("buy me a coffee", () => {
  it("builds a UPI deep link from the configured ID", () => {
    process.env.DONATION_UPI_ID = "youralexhere-2@oksbi";
    process.env.DONATION_PAYEE_NAME = "ALEX";
    const config = donationConfig();
    expect(config).toMatchObject({ upiId: "youralexhere-2@oksbi", payeeName: "ALEX", qrSrc: "/donate/upi-qr.jpg" });
    const link = new URL(upiLink(config!));
    expect(link.protocol).toBe("upi:");
    expect(link.searchParams.get("pa")).toBe("youralexhere-2@oksbi");
    expect(link.searchParams.get("cu")).toBe("INR");
  });

  it("is hidden when the UPI ID is empty or malformed", () => {
    process.env.DONATION_UPI_ID = "";
    expect(donationConfig()).toBeNull();
    process.env.DONATION_UPI_ID = "javascript:alert(1)";
    expect(donationConfig()).toBeNull();
  });

  it("only accepts a QR path inside the site", () => {
    process.env.DONATION_UPI_ID = "someone@okaxis";
    process.env.DONATION_QR_PATH = "https://evil.example/qr.png";
    expect(donationConfig()?.qrSrc).toBeNull();
    process.env.DONATION_QR_PATH = "//evil.example/qr.png";
    expect(donationConfig()?.qrSrc).toBeNull();
  });
});
