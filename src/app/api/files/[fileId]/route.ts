import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getSessionUser } from "@/lib/auth";
import { canViewPaperFile } from "@/server/authz";
import { collegeIdOfPaper, incrementDownload } from "@/server/services/papers";
import { paperCardInclude } from "@/server/repositories/papers";
import { toPublicError } from "@/lib/errors";
import { captureError } from "@/lib/observability";
import { safeFilename } from "@/lib/utils";

/**
 * Authorized file delivery. Objects are never publicly listable: every read
 * goes through this handler, which re-checks visibility server-side.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const file = await prisma.paperFile.findUnique({
      where: { id: fileId },
      include: { paper: { include: paperCardInclude } },
    });
    if (!file) return NextResponse.json({ code: "NOT_FOUND", message: "File not found." }, { status: 404 });

    const user = await getSessionUser();
    const paper = file.paper;
    const allowed = canViewPaperFile(
      {
        status: paper.status,
        restricted: paper.restricted,
        uploadedById: paper.uploadedById,
        collegeId: collegeIdOfPaper(paper),
      },
      user,
    );
    if (!allowed) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "This paper is restricted." },
        { status: 403 },
      );
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    if (download) await incrementDownload(paper.id);

    const signed = await storage().signedUrl(file.storageKey);
    if (signed) return NextResponse.redirect(signed);

    const body = await storage().get(file.storageKey);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeFilename(file.originalName)}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const pub = toPublicError(err);
    if (pub.status >= 500) captureError(err, { route: "file_read" });
    return NextResponse.json({ code: pub.code, message: pub.message }, { status: pub.status });
  }
}
