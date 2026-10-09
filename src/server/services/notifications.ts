import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { pushInbox } from "./inbox";
import { siteUrl } from "@/lib/site";

type Recipient = { email: string; userId?: string };

function link(path: string) {
  return `${siteUrl().replace(/\/$/, "")}${path}`;
}

/**
 * Everyone who can act on an approval request: platform admins plus the
 * moderators and admins of the college the paper belongs to. ADMIN_NOTIFY_EMAIL
 * lets a deployment add an inbox that is not a platform account.
 */
async function approvers(collegeId: string | null): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: "PLATFORM_ADMIN" },
        ...(collegeId ? [{ role: { in: ["MODERATOR", "COLLEGE_ADMIN"] }, collegeId }] : []),
      ],
    },
    select: { id: true, email: true },
  });
  const list: Recipient[] = users.map((u) => ({ email: u.email, userId: u.id }));
  const extra = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (extra && !list.some((r) => r.email.toLowerCase() === extra.toLowerCase())) {
    list.push({ email: extra });
  }
  return list;
}

/** Escapes member-supplied text before it goes into the HTML part. */
export function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strips the inline markup used in the HTML part for the plain-text part. */
const plain = (value: string) =>
  value
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

function wrap(title: string, lines: string[], cta?: { label: string; href: string }) {
  const text = [plain(title), "", ...lines.map(plain), ...(cta ? ["", `${cta.label}: ${cta.href}`] : [])].join(
    "\n",
  );
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;color:#14213d">
  <p style="font:700 18px/1.3 'Space Mono',monospace;margin:0 0 12px">${title}</p>
  ${lines.map((line) => `<p style="margin:0 0 8px;font-size:14px">${line}</p>`).join("")}
  ${
    cta
      ? `<p style="margin:20px 0 0"><a href="${cta.href}" style="display:inline-block;border:2px solid #14213d;background:#14213d;color:#fdf6e3;padding:10px 16px;font:700 13px/1 'Space Mono',monospace;text-decoration:none">${cta.label}</a></p>`
      : ""
  }
  <p style="margin:24px 0 0;font-size:11px;color:#6b7280">PaperVault — student-powered question paper archive.</p>
</div>`;
  return { text, html };
}

/** Records the outbox row first, then attempts delivery. Never throws. */
async function dispatch(
  type: string,
  recipients: Recipient[],
  subject: string,
  content: { text: string; html: string },
  paperId?: string,
) {
  for (const recipient of recipients) {
    let row;
    try {
      row = await prisma.notification.create({
        data: {
          type,
          toEmail: recipient.email,
          toUserId: recipient.userId ?? null,
          paperId: paperId ?? null,
          subject,
          body: content.text,
          status: mailConfigured() ? "QUEUED" : "SKIPPED",
          attempts: mailConfigured() ? 1 : 0,
          lastAttemptAt: mailConfigured() ? new Date() : null,
        },
      });
    } catch (err) {
      logger.error("notification_record_failed", { error: String(err) });
      continue;
    }
    if (!mailConfigured()) continue;
    const result = await sendMail({
      to: recipient.email,
      subject,
      text: content.text,
      html: content.html,
    });
    await prisma.notification
      .update({
        where: { id: row.id },
        data: {
          status: result.status,
          error: result.error ?? null,
          sentAt: result.status === "SENT" ? new Date() : null,
        },
      })
      .catch(() => undefined);
  }
}

type PaperContext = {
  paperId: string;
  title: string;
  collegeId: string | null;
  collegeName: string;
  context: string;
  uploaderName: string;
  uploaderEmail?: string | null;
  uploaderId?: string | null;
  note?: string | null;
};

/** New upload is waiting for an approval decision. */
export async function notifyApprovalRequested(ctx: PaperContext) {
  const recipients = await approvers(ctx.collegeId);
  if (recipients.length === 0) return;
  const subject = `[PaperVault] Approval needed — ${ctx.title}`;
  const content = wrap("A paper is waiting for your approval", [
    `<strong>${ctx.title}</strong>`,
    ctx.context,
    `College: ${ctx.collegeName}`,
    `Uploaded by: ${ctx.uploaderName}`,
    ...(ctx.note ? [`Contributor note: ${ctx.note}`] : []),
  ], { label: "Review this paper", href: link(`/moderation/${ctx.paperId}`) });
  await dispatch("paper.submitted", recipients, subject, content, ctx.paperId);
}

const DECISION_COPY: Record<string, { subject: string; title: string; line: string }> = {
  APPROVED: {
    subject: "approved",
    title: "Your paper was approved",
    line: "A moderator approved your submission. It will appear in the archive once published.",
  },
  PUBLISHED: {
    subject: "published",
    title: "Your paper is live",
    line: "Your submission is now published and discoverable by other students. Thank you for contributing.",
  },
  REJECTED: {
    subject: "rejected",
    title: "Your paper was not accepted",
    line: "A moderator reviewed your submission and could not accept it.",
  },
  CHANGES_REQUESTED: {
    subject: "needs changes",
    title: "Your paper needs changes",
    line: "A moderator asked for changes before this submission can be approved.",
  },
  RESTRICTED: {
    subject: "restricted",
    title: "Your paper is restricted",
    line: "This submission is held back because it may relate to a current or upcoming exam.",
  },
  REMOVED: {
    subject: "removed",
    title: "Your paper was removed",
    line: "A moderator removed this submission from the archive.",
  },
};

/** Tell the contributor what happened to their submission. */
export async function notifyDecision(ctx: PaperContext & { status: string }) {
  const copy = DECISION_COPY[ctx.status];
  if (!copy) return;

  // The in-app notification is unconditional: it is the durable record, and
  // the email preference only governs whether we also send mail.
  if (ctx.uploaderId) {
    await pushInbox({
      userId: ctx.uploaderId,
      type: `paper.${ctx.status.toLowerCase()}`,
      title: `${ctx.title} — ${copy.subject}`,
      body: ctx.note ? `${copy.line} Moderator note: ${ctx.note}` : copy.line,
      href: `/papers/${ctx.paperId}`,
    });
  }

  if (!ctx.uploaderEmail) return;
  if (ctx.uploaderId) {
    const prefs = await prisma.user.findUnique({
      where: { id: ctx.uploaderId },
      select: { notifyOnDecision: true },
    });
    if (prefs && !prefs.notifyOnDecision) return;
  }
  const subject = `[PaperVault] ${ctx.title} — ${copy.subject}`;
  const content = wrap(copy.title, [
    copy.line,
    `<strong>${ctx.title}</strong>`,
    ctx.context,
    ...(ctx.note ? [`Moderator note: ${ctx.note}`] : []),
  ], { label: "Open your submission", href: link(`/papers/${ctx.paperId}`) });
  await dispatch(
    `paper.${ctx.status.toLowerCase()}`,
    [{ email: ctx.uploaderEmail, userId: ctx.uploaderId ?? undefined }],
    subject,
    content,
    ctx.paperId,
  );
}

/** Transactional account email (verification, reset). Always one recipient. */
export async function sendAccountEmail(input: {
  to: string;
  userId?: string;
  type: string;
  subject: string;
  title: string;
  lines: string[];
  cta?: { label: string; href: string };
}) {
  const content = wrap(input.title, input.lines, input.cta);
  await dispatch(input.type, [{ email: input.to, userId: input.userId }], input.subject, content);
}

/** Someone replied to a comment the user wrote. */
export async function notifyCommentReply(input: {
  to: string;
  userId: string;
  paperId: string;
  paperTitle: string;
  authorName: string;
  excerpt: string;
}) {
  await pushInbox({
    userId: input.userId,
    type: "comment.reply",
    title: `${input.authorName} replied to your comment`,
    body: `On ${input.paperTitle}: “${input.excerpt}”`,
    href: `/papers/${input.paperId}#discussion`,
  });

  const content = wrap("Someone replied to your comment", [
    `${input.authorName} replied in the discussion under <strong>${input.paperTitle}</strong>.`,
    `“${input.excerpt}”`,
  ], { label: "Open the discussion", href: link(`/papers/${input.paperId}#discussion`) });
  await dispatch(
    "comment.reply",
    [{ email: input.to, userId: input.userId }],
    `[PaperVault] New reply on ${input.paperTitle}`,
    content,
    input.paperId,
  );
}

/** Give up after this many tries so a permanently bad address cannot loop. */
const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Re-sends mail that failed or never left the queue. Called by the nightly
 * cron job: delivery is fire-and-forget at request time on purpose, so this is
 * what stops a transient SMTP outage from silently losing a verification link.
 */
export async function retryFailedEmails(limit = 50) {
  if (!mailConfigured()) return 0;
  const pending = await prisma.notification.findMany({
    where: {
      status: { in: ["QUEUED", "FAILED"] },
      attempts: { lt: MAX_DELIVERY_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  for (const row of pending) {
    const result = await sendMail({ to: row.toEmail, subject: row.subject, text: row.body });
    if (result.status === "SENT") sent += 1;
    await prisma.notification
      .update({
        where: { id: row.id },
        data: {
          status: result.status,
          error: result.error ?? null,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          sentAt: result.status === "SENT" ? new Date() : null,
        },
      })
      .catch(() => undefined);
  }
  if (pending.length > 0) logger.info("email_retry", { tried: pending.length, sent });
  return sent;
}

export function recentNotifications(take = 50) {
  return prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take });
}

/* ------------------------------------------------------------------------ */
/* Generic member + admin notifications                                      */
/* ------------------------------------------------------------------------ */

/**
 * In-app first (the source of truth), then a short email. Email bodies must
 * never carry sensitive material: no documents, no internal notes.
 */
export async function notifyUser(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  /** Set false for purely in-app nudges. */
  email?: boolean;
}) {
  await pushInbox({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
  });
  if (input.email === false) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, anonymizedAt: true },
    });
    if (!user || user.anonymizedAt) return;
    const content = wrap(
      esc(input.title),
      [esc(input.body)],
      input.href ? { label: "Open PaperVault", href: link(input.href) } : undefined,
    );
    await dispatch(input.type, [{ email: user.email, userId: input.userId }], `[PaperVault] ${input.title}`, content);
  } catch (err) {
    logger.error("notify_user_failed", { type: input.type, error: String(err) });
  }
}

/** The operations mailbox: ADMIN_EMAIL (ADMIN_NOTIFY_EMAIL is the older name). */
export function adminMailbox(): string | null {
  return (process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || "").trim() || null;
}

/**
 * Something needs a platform admin: a ticket, a request, a report, a teacher
 * verification, a security event. Every platform admin gets an inbox item;
 * email goes to the platform admins and the operations mailbox, once each.
 */
export async function notifyAdmins(input: {
  type: string;
  /** Case or ticket reference, e.g. PV-2026-000012. */
  caseId: string;
  title: string;
  summary: string;
  href: string;
  /** Display name of the member involved, if any. Never an email or document. */
  member?: string | null;
}) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "PLATFORM_ADMIN", bannedAt: null, anonymizedAt: null },
      select: { id: true, email: true },
    });
    for (const admin of admins) {
      await pushInbox({
        userId: admin.id,
        type: input.type,
        title: `${input.caseId} · ${input.title}`,
        body: input.summary,
        href: input.href,
      });
    }
    const recipients: Recipient[] = admins.map((a) => ({ email: a.email, userId: a.id }));
    const mailbox = adminMailbox();
    if (mailbox && !recipients.some((r) => r.email.toLowerCase() === mailbox.toLowerCase())) {
      recipients.push({ email: mailbox });
    }
    if (recipients.length === 0) return;
    const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const content = wrap(
      esc(input.title),
      [
        `<strong>Case:</strong> ${esc(input.caseId)}`,
        `<strong>Type:</strong> ${esc(input.type)}`,
        `<strong>Summary:</strong> ${esc(input.summary)}`,
        ...(input.member ? [`<strong>Member:</strong> ${esc(input.member)}`] : []),
        `<strong>When:</strong> ${when}`,
      ],
      { label: "Open in the dashboard", href: link(input.href) },
    );
    await dispatch(input.type, recipients, `[PaperVault] ${input.caseId} — ${input.title}`, content);
  } catch (err) {
    logger.error("notify_admins_failed", { type: input.type, error: String(err) });
  }
}
