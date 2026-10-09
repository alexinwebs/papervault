import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";
import { purgeExpiredPapers } from "@/server/services/recycle-bin";
import { purgeExpiredTokens } from "@/lib/tokens";
import { retryFailedEmails } from "@/server/services/notifications";
import { purgeExpiredTeacherDocuments } from "@/server/services/teacher-verification";

export const dynamic = "force-dynamic";

/** Compares without leaking the secret's length or its matching prefix. */
function secretMatches(presented: string, expected: string) {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Nightly maintenance. Protected by a shared secret rather than a session so a
 * scheduler can call it: `Authorization: Bearer $CRON_SECRET`. GET is accepted
 * too because Vercel Cron issues GET requests with exactly that header.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!secretMatches(header, `Bearer ${secret}`)) {
    logger.warn("cron_unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [papers, tokens, emails, teacherDocuments] = await Promise.all([
    purgeExpiredPapers(),
    purgeExpiredTokens(),
    retryFailedEmails(),
    purgeExpiredTeacherDocuments(),
  ]);
  logger.info("cron_purge", { papers, tokens, emails, teacherDocuments });
  return NextResponse.json({
    purgedPapers: papers,
    purgedTokens: tokens,
    retriedEmails: emails,
    purgedTeacherDocuments: teacherDocuments,
  });
}

export const GET = POST;
