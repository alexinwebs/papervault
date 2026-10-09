"use server";

import { revalidatePath } from "next/cache";
import { assertVerifiedEmail, requireUser } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { imagesToPdf } from "@/lib/pdf";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { uploadMetadataSchema, reportSchema, bookmarkSchema, paperRequestSchema } from "../validators";
import { submitPaper } from "../services/uploads";
import { toggleBookmark } from "../services/library";
import { fileReport } from "../services/reports";
import { requestPaper } from "../services/requests";
import { run, zodErrors, type ActionState } from "./types";

const DATA_URL = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/;

/** Decodes the browser's captured page images, rejecting anything unexpected. */
function parseCapturedPages(raw: string): Array<{ bytes: Buffer; mimeType: string }> | null {
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  const pages: Array<{ bytes: Buffer; mimeType: string }> = [];
  for (const entry of list.slice(0, 30)) {
    if (typeof entry !== "string") return null;
    const match = DATA_URL.exec(entry);
    if (!match) return null;
    pages.push({
      bytes: Buffer.from(match[2], "base64"),
      mimeType: match[1] === "png" ? "image/png" : "image/jpeg",
    });
  }
  return pages;
}

export async function uploadPaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertVerifiedEmail(user);
    await rateLimitAsync(`upload:${user.id}`, 20, 60 * 60_000);

    const entries = Object.fromEntries(formData) as Record<string, unknown>;
    const parsed = uploadMetadataSchema.safeParse(entries);
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    const alsoSubjectIds = formData
      .getAll("alsoSubjectIds")
      .map((value) => String(value))
      .filter(Boolean);

    let bytes: Buffer;
    let name: string;
    let type: string;

    if (String(formData.get("captureMode") ?? "file") === "camera") {
      // Photos taken in the browser arrive as data URLs and become one PDF.
      const captured = parseCapturedPages(String(formData.get("capturedPages") ?? "[]"));
      if (captured === null) {
        return { ok: false, fieldErrors: { file: "Those captured pages could not be read." } };
      }
      if (captured.length === 0) {
        return { ok: false, fieldErrors: { file: "Capture at least one page with the camera." } };
      }
      bytes = await imagesToPdf(captured, { title: "Captured paper", author: user.name });
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        return {
          ok: false,
          fieldErrors: { file: "The captured pages are too large. Remove a page and try again." },
        };
      }
      name = "camera-capture.pdf";
      type = "application/pdf";
    } else {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return { ok: false, fieldErrors: { file: "Attach the paper file." } };
      }
      bytes = Buffer.from(await file.arrayBuffer());
      name = file.name;
      type = file.type;
    }

    const result = await submitPaper({
      user,
      metadata: {
        ...parsed.data,
        sessionLabel: parsed.data.sessionLabel || undefined,
        notes: parsed.data.notes || undefined,
        alsoSubjectIds,
      },
      file: { name, type, bytes },
    });

    revalidatePath("/library");
    revalidatePath("/moderation");
    return {
      ok: true,
      message: "Paper secured. It is queued for moderator review.",
      data: { paperId: result.paperId },
    };
  });
}

export async function toggleBookmarkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = bookmarkSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Invalid paper." };
    const result = await toggleBookmark(user, parsed.data.paperId);
    revalidatePath("/library");
    revalidatePath(`/papers/${parsed.data.paperId}`);
    return { ok: true, message: result.saved ? "Saved to your library." : "Removed from your library." };
  });
}

export async function reportPaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertVerifiedEmail(user);
    await rateLimitAsync(`report:${user.id}`, 10, 60 * 60_000);
    const parsed = reportSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await fileReport(user, {
      paperId: parsed.data.paperId,
      reason: parsed.data.reason,
      details: parsed.data.details || undefined,
    });
    revalidatePath(`/papers/${parsed.data.paperId}`);
    return { ok: true, message: "Report sent to the moderators. Thank you." };
  });
}

export async function requestPaperAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    await rateLimitAsync(`request:${user.id}`, 30, 60 * 60_000);
    const parsed = paperRequestSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
    await requestPaper(user, parsed.data);
    return { ok: true, message: "Request recorded. We will notify contributors from your college." };
  });
}
