import { describe, expect, it } from "vitest";
import { detectMime, extensionFor } from "@/server/services/uploads";
import { metadataFingerprint, sha256 } from "@/lib/hash";
import { safeFilename } from "@/lib/utils";
import { uploadMetadataSchema } from "@/server/validators";

const pdf = Buffer.from("%PDF-1.4\n...", "latin1");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const html = Buffer.from("<html><script>alert(1)</script>", "utf8");

describe("content validation", () => {
  it("detects real file types from magic bytes, not the extension", () => {
    expect(detectMime(pdf)).toBe("application/pdf");
    expect(detectMime(png)).toBe("image/png");
    expect(detectMime(jpeg)).toBe("image/jpeg");
  });

  it("rejects a disguised HTML payload", () => {
    expect(detectMime(html)).toBeNull();
  });

  it("maps mime types to safe extensions", () => {
    expect(extensionFor("application/pdf")).toBe("pdf");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/jpeg")).toBe("jpg");
  });

  it("sanitises filenames and strips traversal", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("dbms st 2025.pdf")).toBe("dbms_st_2025.pdf");
  });
});

describe("duplicate detection", () => {
  it("produces a stable hash for identical bytes", () => {
    expect(sha256(pdf)).toBe(sha256(Buffer.from("%PDF-1.4\n...", "latin1")));
  });

  it("produces different hashes for different bytes", () => {
    expect(sha256(pdf)).not.toBe(sha256(png));
  });

  it("treats the same exam slot as the same metadata fingerprint", () => {
    const base = { subjectId: "s1", examTypeId: "e1", academicYear: 2025, setLabel: "Set A" };
    expect(metadataFingerprint(base)).toBe(
      metadataFingerprint({ ...base, setLabel: "set a" }),
    );
    expect(metadataFingerprint(base)).not.toBe(
      metadataFingerprint({ ...base, academicYear: 2024 }),
    );
    expect(metadataFingerprint(base)).not.toBe(metadataFingerprint({ ...base, setLabel: "Set B" }));
  });
});

describe("upload metadata validation", () => {
  const valid = {
    collegeId: "c1",
    programId: "p1",
    branchId: "b1",
    semesterId: "s1",
    subjectId: "su1",
    examTypeId: "e1",
    academicYear: "2024",
    setLabel: "Set A",
    examClassification: "PAST",
  };

  it("accepts a complete payload and coerces the year", () => {
    const parsed = uploadMetadataSchema.parse(valid);
    expect(parsed.academicYear).toBe(2024);
  });

  it("rejects a year beyond next year", () => {
    const future = String(new Date().getFullYear() + 5);
    expect(uploadMetadataSchema.safeParse({ ...valid, academicYear: future }).success).toBe(false);
  });

  it("requires the full academic chain", () => {
    const { subjectId: _subjectId, ...withoutSubject } = valid;
    expect(uploadMetadataSchema.safeParse(withoutSubject).success).toBe(false);
  });
});

describe("camera capture to PDF", () => {
  it("builds a single PDF from captured JPEG pages", async () => {
    const { imagesToPdf, pdfPageCount } = await import("@/lib/pdf");
    // 1x1 JPEG
    const jpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAAIAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
      "base64",
    );
    const pdf = await imagesToPdf([
      { bytes: jpeg, mimeType: "image/jpeg" },
      { bytes: jpeg, mimeType: "image/jpeg" },
    ]);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(await pdfPageCount(pdf)).toBe(2);
  });

  it("refuses an empty capture", async () => {
    const { imagesToPdf } = await import("@/lib/pdf");
    await expect(imagesToPdf([])).rejects.toThrow(/at least one page/i);
  });
});

describe("pdf sanitisation", () => {
  it("rewrites a valid PDF and reports success", async () => {
    const { imagesToPdf, sanitizePdf } = await import("@/lib/pdf");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const pdf = await imagesToPdf([{ bytes: png, mimeType: "image/png" }]);
    const result = await sanitizePdf(pdf);
    expect(result.sanitized).toBe(true);
    expect(result.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("is deterministic, so the same document always hashes the same", async () => {
    const { imagesToPdf, sanitizePdf } = await import("@/lib/pdf");
    const { sha256 } = await import("@/lib/hash");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const pdf = await imagesToPdf([{ bytes: png, mimeType: "image/png" }]);
    const first = await sanitizePdf(pdf);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await sanitizePdf(pdf);
    // Without pinned dates pdf-lib stamps "now" into the output and duplicate
    // detection by file hash silently stops working.
    expect(sha256(second.bytes)).toBe(sha256(first.bytes));
  });

  it("reports failure for bytes that are not a PDF", async () => {
    const { sanitizePdf } = await import("@/lib/pdf");
    const result = await sanitizePdf(Buffer.from("not a pdf at all"));
    expect(result.sanitized).toBe(false);
  });
});

describe("extractPdfText", () => {
  it("pulls the text layer out of a generated PDF", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595.28, 841.89]);
    page.drawText("Explain two-phase locking and conflict-serializable schedules.", {
      x: 40,
      y: 780,
      size: 12,
      font,
    });
    const bytes = Buffer.from(await doc.save());

    const { extractPdfText } = await import("@/lib/pdf");
    const text = await extractPdfText(bytes);
    expect(text).toContain("two-phase locking");
  });

  it("returns null for a PDF with no readable text", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const { extractPdfText } = await import("@/lib/pdf");
    expect(await extractPdfText(Buffer.from(await doc.save()))).toBeNull();
  });

  it("returns null instead of throwing on unreadable bytes", async () => {
    const { extractPdfText } = await import("@/lib/pdf");
    expect(await extractPdfText(Buffer.from("not a pdf at all", "latin1"))).toBeNull();
  });
});

describe("exam classification", () => {
  const base = {
    collegeId: "c1",
    programId: "p1",
    branchId: "b1",
    semesterId: "s1",
    subjectId: "su1",
    examTypeId: "e1",
    academicYear: "2024",
    setLabel: "",
  };
  it("requires the uploader to classify the exam", () => {
    expect(uploadMetadataSchema.safeParse(base).success).toBe(false);
    expect(uploadMetadataSchema.safeParse({ ...base, examClassification: "PAST" }).success).toBe(true);
  });
});
