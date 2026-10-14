import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { boundedFormData } from "@/lib/bounded-form-data";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { detectPaperAction } from "@/server/actions/detection";
import { idle } from "@/server/actions/types";
import { toPublicError } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store" };

/** Separate, abortable request: optional reading cannot hold the submission action queue. */
export async function POST(request: Request) {
  try {
    if (!await getSessionUser()) return NextResponse.json({ ok: false, message: "Sign in to read a paper.", code: "UNAUTHENTICATED" }, { status: 401, headers });
    if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES * 2 + 1024 * 1024) return NextResponse.json({ ok: false, message: "The paper exceeds the upload size limit." }, { status: 413, headers });
    const data = await boundedFormData(request, MAX_UPLOAD_BYTES * 2 + 1024 * 1024);
    if (request.signal.aborted) return new NextResponse(null, { status: 499, headers });
    // Reuses verified-email, signature/size, malware and per-user rate checks.
    const result = await detectPaperAction(idle, data);
    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "RATE_LIMITED" ? 429 : 400, headers });
  } catch (error) {
    const publicError = toPublicError(error);
    return NextResponse.json({ ok: false, message: publicError.message, code: publicError.code }, { status: publicError.status, headers });
  }
}
