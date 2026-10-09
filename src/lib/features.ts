/**
 * Operator switches read on the server at request time, so changing .env and
 * restarting is enough (no rebuild). Never import this from client components.
 */

/** TEACHER_VERIFICATION_ENABLED=false closes new applications and hides the links. */
export function teacherVerificationEnabled() {
  return (process.env.TEACHER_VERIFICATION_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

export type DonationConfig = { upiId: string; payeeName: string; qrSrc: string | null };

/**
 * "Buy the admin a coffee". DONATION_UPI_ID turns it on; set it to an empty
 * value to hide the page and its links. DONATION_QR_PATH points at an image in
 * /public (defaults to the bundled QR).
 */
export function donationConfig(): DonationConfig | null {
  const upiId = (process.env.DONATION_UPI_ID ?? "youralexhere-2@oksbi").trim();
  if (!upiId || !/^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/.test(upiId)) return null;
  const payeeName = (process.env.DONATION_PAYEE_NAME ?? "ALEX").trim().slice(0, 60) || "PaperVault";
  const qr = (process.env.DONATION_QR_PATH ?? "/donate/upi-qr.jpg").trim();
  return { upiId, payeeName, qrSrc: qr.startsWith("/") && !qr.startsWith("//") ? qr : null };
}

/** upi:// deep link that opens GPay / PhonePe / Paytm / BHIM on a phone. */
export function upiLink(c: DonationConfig) {
  const params = new URLSearchParams({ pa: c.upiId, pn: c.payeeName, cu: "INR", tn: "Coffee for PaperVault" });
  return `upi://pay?${params.toString()}`;
}
