import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { exportAccountData } from "@/server/services/account";
import { toPublicError } from "@/lib/errors";
import { captureError } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Right of access: everything we hold about the caller, as one JSON download.
 * Deliberately a GET so it works as a plain link, and deliberately scoped to
 * the session user with no id parameter to get wrong.
 */
export async function GET() {
  try {
    const user = await requireUser();
    await rateLimitAsync(`account-export:${user.id}`, 5, 60 * 60_000);
    const payload = await exportAccountData(user);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="papervault-account-${user.id}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const pub = toPublicError(err);
    if (pub.status >= 500) captureError(err, { route: "account_export" });
    return NextResponse.json(
      { error: pub.message, code: pub.code },
      { status: pub.status, headers: { "cache-control": "no-store" } },
    );
  }
}
