import { createHash } from "node:crypto";

export function sha256(buf: Buffer | Uint8Array) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Metadata fingerprint used alongside the file hash for duplicate detection.
 * Perceptual hashing / OCR text similarity plug in behind the same boundary later.
 */
export function metadataFingerprint(input: {
  subjectId: string;
  examTypeId: string;
  academicYear: number;
  sessionLabel?: string | null;
  setLabel?: string | null;
}) {
  const key = [
    input.subjectId,
    input.examTypeId,
    input.academicYear,
    (input.sessionLabel ?? "").trim().toLowerCase(),
    (input.setLabel ?? "set a").trim().toLowerCase(),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}
