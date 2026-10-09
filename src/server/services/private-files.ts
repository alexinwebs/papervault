import { randomUUID } from "node:crypto";
import { validation } from "@/lib/errors";
import { sha256 } from "@/lib/hash";
import { safeFilename } from "@/lib/utils";
import { sanitizePdf } from "@/lib/pdf";
import { assertClean, scanUpload } from "@/lib/scanner";
import { detectMime, extensionFor } from "./uploads";

export type InspectedFile = {
  bytes: Buffer;
  mime: string;
  extension: string;
  sha256: string;
  originalName: string;
  scanEngine: string;
};

/**
 * Shared gate for private uploads (teacher verification proof, ticket
 * attachments). Same rules as paper uploads: size limit, content sniffing
 * (the declared type is ignored), malware scan that fails closed, and PDFs
 * re-written to drop scripts and embedded files. Nothing is stored here.
 */
export async function inspectPrivateFile(
  file: { name: string; bytes: Buffer },
  rules: { maxBytes: number; allowed: readonly string[]; label: string },
): Promise<InspectedFile> {
  if (file.bytes.byteLength === 0) throw validation(`${rules.label}: the file is empty.`);
  if (file.bytes.byteLength > rules.maxBytes) {
    throw validation(`${rules.label}: files must be under ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`);
  }
  const mime = detectMime(file.bytes);
  if (!mime || !rules.allowed.includes(mime)) {
    throw validation(`${rules.label}: only PDF, JPG and PNG files are accepted.`);
  }
  const scan = await scanUpload(file.bytes);
  assertClean(scan);

  let bytes = file.bytes;
  if (mime === "application/pdf") {
    const cleaned = await sanitizePdf(bytes);
    if (!cleaned.sanitized) throw validation(`${rules.label}: that PDF could not be read. Try exporting it again.`);
    bytes = cleaned.bytes;
  }
  return {
    bytes,
    mime,
    extension: extensionFor(mime),
    sha256: sha256(bytes),
    originalName: safeFilename(file.name),
    scanEngine: scan.engine,
  };
}

/** Random, non-guessable key under a private prefix. Never derived from user input. */
export function privateStorageKey(prefix: "teacher-verification" | "tickets", ownerId: string, extension: string) {
  const owner = ownerId.replace(/[^a-z0-9]/gi, "");
  const ext = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `private/${prefix}/${owner}/${randomUUID()}.${ext}`;
}

/** Pulls File entries for one field out of a FormData, ignoring empty inputs. */
export async function filesFrom(formData: FormData, field: string, max: number) {
  const entries = formData.getAll(field).filter((v): v is File => typeof v === "object" && v !== null && "arrayBuffer" in v);
  const real = entries.filter((f) => f.size > 0);
  if (real.length > max) throw validation(`Attach at most ${max} files.`);
  return Promise.all(real.map(async (f) => ({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })));
}
