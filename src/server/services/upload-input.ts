import { validation } from "@/lib/errors";
import { imagesToPdf } from "@/lib/pdf";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
const DATA_URL = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/;

/** Decodes the browser's captured page images, rejecting anything unexpected. */
export function parseCapturedPages(raw: string): Array<{ bytes: Buffer; mimeType: string }> | null {
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


export async function uploadFileFromForm(formData: FormData, userName: string) {
  if (String(formData.get("captureMode") ?? "file") === "camera") {
    const captured = parseCapturedPages(String(formData.get("capturedPages") ?? "[]"));
    if (!captured?.length) throw validation("Capture at least one valid page with the camera.");
    const bytes = await imagesToPdf(captured, { title: "Captured paper", author: userName });
    if (bytes.length > MAX_UPLOAD_BYTES) throw validation("The captured pages are too large. Remove a page and try again.");
    return { bytes, name: "camera-capture.pdf", type: "application/pdf" };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw validation("Attach the paper file.");
  if (file.size > MAX_UPLOAD_BYTES) throw validation("The paper exceeds the upload size limit.");
  return { bytes: Buffer.from(await file.arrayBuffer()), name: file.name, type: file.type };
}
