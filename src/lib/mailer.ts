import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult = { status: "SENT" | "SKIPPED" | "FAILED"; error?: string };

/**
 * Gmail is the default production channel. Create an App Password at
 * https://myaccount.google.com/apppasswords (2-Step Verification must be on)
 * and set GMAIL_USER + GMAIL_APP_PASSWORD. Any other SMTP provider works by
 * setting MAIL_DRIVER=smtp with SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS.
 * Transactional HTTP APIs are supported too: MAIL_DRIVER=resend with
 * RESEND_API_KEY, or MAIL_DRIVER=postmark with POSTMARK_SERVER_TOKEN (both
 * need MAIL_FROM on a domain verified with the provider).
 * With no credentials the app falls back to a log-only driver so local
 * development never needs a mailbox.
 */
export type MailDriver = "gmail" | "smtp" | "resend" | "postmark" | "log";

export function driver(): MailDriver {
  const explicit = process.env.MAIL_DRIVER?.toLowerCase();
  if (
    explicit === "gmail" ||
    explicit === "smtp" ||
    explicit === "log" ||
    explicit === "resend" ||
    explicit === "postmark"
  ) {
    return explicit;
  }
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.POSTMARK_SERVER_TOKEN) return "postmark";
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  if (process.env.SMTP_HOST && process.env.SMTP_USER) return "smtp";
  return "log";
}

let cached: Transporter | null = null;

function transporter(): Transporter | null {
  if (cached) return cached;
  const kind = driver();
  if (kind === "gmail") {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return null;
    cached = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    return cached;
  }
  if (kind === "smtp") {
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    const port = Number(process.env.SMTP_PORT ?? 587);
    cached = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    return cached;
  }
  return null;
}

export function mailFrom() {
  return (
    process.env.MAIL_FROM ||
    (process.env.GMAIL_USER ? `PaperVault <${process.env.GMAIL_USER}>` : "PaperVault <no-reply@papervault.local>")
  );
}

export function mailConfigured() {
  const kind = driver();
  if (kind === "resend") return Boolean(process.env.RESEND_API_KEY);
  if (kind === "postmark") return Boolean(process.env.POSTMARK_SERVER_TOKEN);
  return kind !== "log";
}

/** Resend / Postmark over HTTPS. Same never-throw contract as SMTP. */
async function sendViaApi(kind: "resend" | "postmark", message: MailMessage): Promise<MailResult> {
  const timeout = AbortSignal.timeout(15_000);
  try {
    let res: Response;
    if (kind === "resend") {
      const key = process.env.RESEND_API_KEY;
      if (!key) return { status: "SKIPPED", error: "RESEND_API_KEY is not set." };
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: mailFrom(),
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: timeout,
      });
    } else {
      const token = process.env.POSTMARK_SERVER_TOKEN;
      if (!token) return { status: "SKIPPED", error: "POSTMARK_SERVER_TOKEN is not set." };
      res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          From: mailFrom(),
          To: message.to,
          Subject: message.subject,
          TextBody: message.text,
          HtmlBody: message.html,
          MessageStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
        }),
        signal: timeout,
      });
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      logger.error("mail_failed", { to: message.to, driver: kind, status: res.status });
      return { status: "FAILED", error: `${kind} responded ${res.status}: ${detail}` };
    }
    logger.info("mail_sent", { to: message.to, subject: message.subject, driver: kind });
    return { status: "SENT" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("mail_failed", { to: message.to, driver: kind, error });
    return { status: "FAILED", error };
  }
}

/** Never throws: mail failures must not roll back an upload or a decision. */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const kind = driver();
  if (kind === "resend" || kind === "postmark") return sendViaApi(kind, message);
  const tx = transporter();
  if (!tx) {
    logger.info("mail_skipped", { to: message.to, subject: message.subject });
    return { status: "SKIPPED", error: "No mail transport configured (MAIL_DRIVER=log)." };
  }
  try {
    await tx.sendMail({
      from: mailFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    logger.info("mail_sent", { to: message.to, subject: message.subject });
    return { status: "SENT" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("mail_failed", { to: message.to, error });
    return { status: "FAILED", error };
  }
}
