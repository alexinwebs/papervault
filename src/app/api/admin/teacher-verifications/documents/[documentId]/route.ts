import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { toPublicError } from "@/lib/errors";
import { captureError } from "@/lib/observability";
import { safeFilename } from "@/lib/utils";
import { openTeacherDocument } from "@/server/services/teacher-verification";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  // A document is data, never a page that can run script.
  "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
};

/**
 * Teacher verification documents. Platform admins only (re-checked with 2FA
 * on every request); each read is audited. With S3 signed URLs enabled this
 * answers with a 60-second presigned redirect; otherwise it streams the bytes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "Sign in to continue." }, { status: 401, headers: PRIVATE_HEADERS });
    }
    const { documentId } = await params;
    const doc = await openTeacherDocument(user, documentId);
    if (doc.kind === "redirect") {
      return NextResponse.redirect(doc.url, { status: 302, headers: PRIVATE_HEADERS });
    }
    return new NextResponse(new Uint8Array(doc.bytes), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": doc.mime,
        "Content-Length": String(doc.bytes.byteLength),
        "Content-Disposition": `inline; filename="${safeFilename(doc.filename)}"`,
      },
    });
  } catch (err) {
    const pub = toPublicError(err);
    if (pub.status >= 500) captureError(err, { route: "teacher_document_read" });
    return NextResponse.json({ code: pub.code, message: pub.message }, { status: pub.status, headers: PRIVATE_HEADERS });
  }
}
