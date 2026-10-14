import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePaperHeader } from "@/lib/paper-detection";
import { sha256 } from "@/lib/hash";
import { prepareScanHeaders } from "./scan-preparation";
import { validation, AppError } from "@/lib/errors";
const exec = promisify(execFile);
type Reading = { text: string; method: "text" | "ocr" | "none"; complete: boolean; warnings: string[]; metadataTexts?: string[] };
const READER_VERSION = "local-v14";
const inFlight = new Map<string, Promise<Reading>>();
const cache = new Map<string, { reading: Reading; expires: number }>();
let activeOcr = 0;
const cacheCleanup = setInterval(() => { for (const [key, value] of cache) if (value.expires <= Date.now()) cache.delete(key); }, 60_000);
cacheCleanup.unref();

/** No remote API. Native OCR is bounded and temporary files are always deleted. */
export async function readPaperText(bytes: Buffer, mime: string, purpose: "detect" | "submit" = "detect"): Promise<Reading> {
  const key = `${READER_VERSION}:${sha256(bytes)}:${purpose}`;
  const running = inFlight.get(key);
  if (running) return running;
  const promise = readUncached(bytes, mime, purpose, key);
  inFlight.set(key, promise);
  try { return await promise; } finally { inFlight.delete(key); }
}
async function readUncached(bytes: Buffer, mime: string, purpose: "detect" | "submit", key: string): Promise<Reading> {
  const found = cache.get(key);
  if (found && found.expires > Date.now()) return found.reading;
  let pageCount = 1;
  let nativeHeader = "";
  if (mime === "application/pdf") {
    const { getDocumentProxy } = await import("unpdf");
    let doc;
    try { doc = await getDocumentProxy(new Uint8Array(bytes), { maxImageSize: 4_000_000 }); }
    catch { return remember(key, {text:"",method:"none",complete:false,warnings:["This PDF is damaged, encrypted or unreadable. Replace it with a readable PDF or enter the details manually."]}); }
    try {
      pageCount = doc.numPages;
      if (pageCount > 100) throw validation("Detection supports PDFs with up to 100 pages. Split this paper into a smaller file.");
      const chunks: string[] = [];
      const count = purpose === "detect" ? Math.min(2, pageCount) : pageCount;
      for (let i = 1; i <= count; i++) {
        const content = await (await doc.getPage(i)).getTextContent();
        chunks.push(content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
      }
      const text = chunks.join("\n").trim().slice(0, 20000);
      if (text.replace(/\s/g, "").length >= 40) {
        const fields = parsePaperHeader(text);
        const useful = [fields.collegeName, fields.subjectName, fields.subjectCode, fields.semesterNumber, fields.programName].filter(Boolean).length;
        if (purpose === "submit" || useful >= 3) return remember(key, { text, method: "text", complete: count === pageCount, warnings: [] });
        nativeHeader = text; // A watermark/footer text layer must not hide a scanned header.
      }
    } finally { await doc.loadingTask.destroy(); }
  }
  if (activeOcr >= 2 && purpose === "submit") return { text: "", method: "none", complete: false, warnings: ["The reader was busy; file and exam-slot checks still apply."] };
  if (activeOcr >= 2) throw new AppError("RATE_LIMITED", "The document reader is busy. Please retry detection in a moment.");
  activeOcr++;
  let dir: string | undefined;
  const deadline=Date.now()+(purpose==="detect"?75000:90000);
  const runProcess = (command: string, args: string[], options: {timeout:number; killSignal:"SIGKILL"; maxBuffer:number; env?:NodeJS.ProcessEnv}) => {
    const remaining=deadline-Date.now();
    if(remaining<=0) throw validation("The reader took too long. Enter any missing details manually.");
    return exec(command,args,{...options,timeout:Math.min(options.timeout,remaining)});
  };
  try {
    dir = await mkdtemp(join(tmpdir(), "pv-ocr-"));
    const file = join(dir, mime === "application/pdf" ? "paper.pdf" : "image");
    await writeFile(file, bytes, { mode: 0o600 });
    const count = purpose === "detect" ? Math.min(1, pageCount) : Math.min(12, pageCount);
    let images = [file];
    if (mime === "application/pdf") {
      await runProcess("pdftoppm", ["-f", "1", "-l", String(count), "-scale-to", "1800", "-gray", "-png", file, join(dir, "page")], { timeout: 20000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
      images = (await readdir(dir)).filter((name) => name.endsWith(".png")).sort().map((name) => join(dir!, name));
    }
    const chunks: string[] = [];
    const started = Date.now();
    for (const image of images) {
      if (Date.now() - started > 80000) break;
      const { stdout } = await runProcess("tesseract", [image, "stdout", "-l", "eng", "--psm", "6"], { timeout: 12000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, env: { ...process.env, OMP_THREAD_LIMIT: "1" } });
      chunks.push(stdout.trim());
    }
    const warnings: string[] = [];
    // Page 1 usually contains the whole header. Avoid OCRing a second page
    // before the useful result; consult page 2 only when the header is still missing.
    const metadataTexts: string[] = [];
    const first = chunks[0] ?? "";
    const initial = parsePaperHeader(first);
    if (purpose === "detect" && (!initial.subjectCode || !initial.semesterNumber || !initial.subjectName)) {
      try {
        let retryImage = images[0];
        if (mime === "application/pdf") {
          await runProcess("pdftoppm", ["-f", "1", "-l", "1", "-scale-to", "2600", "-gray", "-png", file, join(dir, "header")], { timeout: 15000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
          retryImage = (await readdir(dir)).filter((name) => /^header-.*\.png$/.test(name)).map((name) => join(dir!, name))[0];
        }
        if (retryImage) {
          const jobs: Array<{ image: string; layout: string }> = [{ image: retryImage, layout: "12" }];
          if (mime === "application/pdf") {
            await runProcess("pdftoppm", ["-f", "1", "-l", "1", "-scale-to", "2600", "-gray", "-png", "-x", "0", "-y", "0", "-W", "2600", "-H", "1000", file, join(dir, "crop")], { timeout: 15000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
            const crop = (await readdir(dir)).find((name) => /^crop-.*\.png$/.test(name));
            if (crop) jobs.push({ image: join(dir, crop), layout: "6" }, { image: join(dir, crop), layout: "12" });
          } else jobs.push({ image: retryImage, layout: "6" });
          for (const { image, layout } of jobs) {
            const alternate = await runProcess("tesseract", [image, "stdout", "-l", "eng", "--psm", layout], { timeout: 12000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, env: { ...process.env, OMP_THREAD_LIMIT: "1" } });
            metadataTexts.push(alternate.stdout.trim());
          }
          const recovered = [initial, ...metadataTexts.map(parsePaperHeader)];
          if (!recovered.some((f) => f.subjectCode && f.subjectName && f.semesterNumber)) {
            const prepared = await prepareScanHeaders(retryImage, dir);
            for (const [index, image] of prepared.images.entries()) {
              const result = await runProcess("tesseract", [image, "stdout", "-l", "eng", "--psm", index === 0 ? "6" : "12"], { timeout: 12000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, env: { ...process.env, OMP_THREAD_LIMIT: "1" } });
              metadataTexts.push(result.stdout.trim());
              if (Object.values(parsePaperHeader(result.stdout)).length >= 5 && parsePaperHeader(result.stdout).subjectCode && parsePaperHeader(result.stdout).semesterNumber) break;
            }
            warnings.push(prepared.adjusted ? "An upright, deskewed header was compared with the original. Please verify the details." : "Original and contrast-cleaned header crops were compared. Please verify the details.");
          }
          warnings.push("Block and automatic-orientation layouts were compared to recover printed fields. Please verify the detected details.");
        }
      } catch { warnings.push("The focused header retry was unavailable. Please check or enter the missing details."); }
    }
    if (purpose === "detect" && pageCount > 1 && ![initial,...metadataTexts.map(parsePaperHeader)].some(f=>f.subjectCode&&f.subjectName&&f.semesterNumber)) {
      try {
        await runProcess("pdftoppm", ["-f","2","-l","2","-scale-to","1800","-gray","-png",file,join(dir,"fallback")],{timeout:15000,killSignal:"SIGKILL",maxBuffer:1024*1024});
        const second=(await readdir(dir)).find(name=>/^fallback-.*\.png$/.test(name));
        if (second) { const result=await runProcess("tesseract",[join(dir,second),"stdout","-l","eng","--psm","6"],{timeout:12000,killSignal:"SIGKILL",maxBuffer:1024*1024,env:{...process.env,OMP_THREAD_LIMIT:"1"}}); metadataTexts.push(result.stdout.trim()); }
      } catch { warnings.push("The second-page fallback was unavailable. Enter any missing fields manually."); }
    }
    const complete = count === pageCount && chunks.length === images.length;

    return remember(key, { text: (nativeHeader || chunks.join("\n")).slice(0, 20000), method: "ocr", complete, metadataTexts: nativeHeader ? [chunks.join("\n").slice(0, 20000), ...metadataTexts] : metadataTexts,
      warnings: complete ? warnings : [...warnings, "Only the first pages were read. File-hash and exam-slot duplicate checks still apply; partial OCR is not used as a content fingerprint."] });
  } catch (err) {
    // Metadata detection is optional; ordinary uploads must still be possible.
    if (purpose === "submit") return { text: "", method: "none", complete: false, warnings: ["OCR was unavailable; file and slot duplicate checks still apply."] };
    return remember(key, { text: "", method: "none", complete: false, warnings: [Date.now()>=deadline ? "Detection reached its time limit. Keep the detected details you reviewed, or enter missing fields manually." : (err as NodeJS.ErrnoException).code === "ENOENT" ? "OCR is not installed on this server. Rebuild using the updated Dockerfile, or enter the details manually." : "This scan could not be read clearly. Enter or correct the missing details manually."] });
  } finally { activeOcr--; if (dir) await rm(dir, { recursive: true, force: true }); }
}
function remember(key: string, reading: Reading) {
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, { reading, expires: Date.now() + (reading.method === "none" ? 30_000 : 10 * 60_000) });
  return reading;
}
