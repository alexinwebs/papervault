import { PDFDocument, degrees } from "pdf-lib";
import { validation } from "./errors";

const A4 = { width: 595.28, height: 841.89 };

/** Fixed timestamp used to keep sanitized PDFs byte-for-byte reproducible. */
const EPOCH = new Date(0);

/**
 * Node pools small Buffers inside a shared ArrayBuffer, so `buffer.buffer` can
 * start at a non-zero offset. pdf-lib reads the raw ArrayBuffer, which then
 * makes it miss the JPEG/PNG header. Copy into a standalone view first.
 */
const standalone = (bytes: Buffer | Uint8Array) => new Uint8Array(bytes);

/**
 * Builds a single PDF from captured page images. Used by the in-browser camera
 * flow so a phone photo becomes a proper archival PDF, identical in every way
 * to a file the student uploaded themselves.
 */
export async function imagesToPdf(
  images: Array<{ bytes: Buffer; mimeType: string }>,
  meta?: { title?: string; author?: string },
) {
  if (images.length === 0) throw validation("Capture at least one page.");
  if (images.length > 30) throw validation("A single upload can hold at most 30 pages.");

  const pdf = await PDFDocument.create();
  pdf.setProducer("PaperVault");
  pdf.setCreator("PaperVault camera capture");
  if (meta?.title) pdf.setTitle(meta.title);
  if (meta?.author) pdf.setAuthor(meta.author);
  pdf.setCreationDate(new Date());

  for (const image of images) {
    const data = standalone(image.bytes);
    const embedded =
      image.mimeType === "image/png" ? await pdf.embedPng(data) : await pdf.embedJpg(data);

    // Fit the photo inside an A4 page, preserving its aspect ratio, and rotate
    // the page for landscape shots so text stays upright.
    const landscape = embedded.width > embedded.height;
    const pageWidth = landscape ? A4.height : A4.width;
    const pageHeight = landscape ? A4.width : A4.height;
    const page = pdf.addPage([pageWidth, pageHeight]);

    const margin = 14;
    const scale = Math.min(
      (pageWidth - margin * 2) / embedded.width,
      (pageHeight - margin * 2) / embedded.height,
    );
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    page.drawImage(embedded, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
      rotate: degrees(0),
    });
  }

  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

/**
 * Re-writes an uploaded PDF through pdf-lib, dropping JavaScript, embedded
 * files, and open actions. Returns the original bytes if the document cannot
 * be parsed — the caller decides whether to reject it.
 */
export async function sanitizePdf(bytes: Buffer): Promise<{ bytes: Buffer; sanitized: boolean }> {
  try {
    const source = await PDFDocument.load(standalone(bytes), { ignoreEncryption: true, updateMetadata: false });
    const clean = await PDFDocument.create();
    const pages = await clean.copyPages(source, source.getPageIndices());
    for (const page of pages) clean.addPage(page);
    clean.setProducer("PaperVault");
    clean.setCreator("PaperVault");
    // Deterministic output. pdf-lib stamps "now" into every new document, so
    // without fixed dates the same file sanitized twice produces different
    // bytes — and therefore a different hash, which would defeat duplicate
    // detection. Pinning the dates makes the hash a property of the document.
    clean.setCreationDate(EPOCH);
    clean.setModificationDate(EPOCH);
    return { bytes: Buffer.from(await clean.save({ useObjectStreams: true })), sanitized: true };
  } catch {
    return { bytes, sanitized: false };
  }
}

/** Page count without loading a rendering engine. */
export async function pdfPageCount(bytes: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(standalone(bytes), { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

/** How much extracted text we keep. Enough for search, small enough to index. */
const MAX_EXTRACTED_CHARS = 20_000;

/**
 * Pulls the text layer out of a PDF so papers are searchable by their
 * contents, not just their metadata. Scanned photographs have no text layer,
 * so an empty result is normal and not an error.
 */
export async function extractPdfText(bytes: Buffer): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const proxy = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(proxy, { mergePages: true });
    const normalized = String(text)
      .replace(/\s+/g, " ")
      .replace(/[\u0000-\u001f]/g, " ")
      .trim();
    if (normalized.length < 20) return null;
    return normalized.slice(0, MAX_EXTRACTED_CHARS);
  } catch {
    // A PDF we cannot read for text is still a perfectly good archive file.
    return null;
  }
}
