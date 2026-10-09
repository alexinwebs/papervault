import { PDFDocument, StandardFonts } from "pdf-lib";

/** Enough real question text that the content fingerprint has something to work with. */
const QUESTIONS = [
  "Section A — Attempt all questions. Each question carries two marks.",
  "1. Define a relation and explain the difference between a candidate key",
  "   and a super key with one short example for each.",
  "2. State the three levels of the ANSI/SPARC database architecture and",
  "   explain what physical data independence means in that model.",
  "3. Write a relational algebra expression that lists every student who has",
  "   enrolled in at least two different courses in the same semester.",
  "Section B — Attempt any three questions. Each question carries ten marks.",
  "4. Normalise the given relation up to third normal form, showing the",
  "   functional dependencies you used at every step of the decomposition.",
  "5. Compare two-phase locking with timestamp ordering as concurrency",
  "   control protocols, and describe one schedule each one rejects.",
  "6. Explain write-ahead logging and describe how a database recovers from",
  "   a system crash using the undo and redo phases of the log.",
];

export type PdfOptions = {
  /** Pages to draw. */
  pages?: number;
  /**
   * Nudges every line by a couple of points. The extracted text is unchanged,
   * but the bytes are not — this is how a re-scanned or re-exported copy of
   * the same paper behaves.
   */
  shift?: number;
};

/**
 * Builds a genuine, parseable PDF for upload tests. The server rejects PDFs it
 * cannot re-write through pdf-lib, so fixtures have to be real documents.
 */
export async function makePdf(
  marker: string,
  pagesOrOptions: number | PdfOptions = 1,
): Promise<Buffer> {
  const options: PdfOptions =
    typeof pagesOrOptions === "number" ? { pages: pagesOrOptions } : pagesOrOptions;
  const pages = options.pages ?? 1;
  const shift = options.shift ?? 0;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setTitle(marker);
  for (let index = 0; index < pages; index += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    const lines = [`PaperVault test fixture ${marker} — page ${index + 1}`, ...QUESTIONS];
    lines.forEach((line, row) => {
      page.drawText(line, { x: 48 + shift, y: 780 - row * 22, size: 11, font });
    });
  }
  return Buffer.from(await pdf.save());
}
