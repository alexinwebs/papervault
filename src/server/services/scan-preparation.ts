import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
const exec = promisify(execFile);

/** Projection-based small-skew estimate. Conservative: do not rotate weak evidence. */
export function estimateSkew(pixels: Uint8Array, width: number, height: number): number {
  const points: Array<[number, number]> = [];
  // Ignore the outer edges (phone shadows and page borders). Sample to bound CPU.
  for (let y = Math.floor(height * .06); y < height * .75; y++)
    for (let x = Math.floor(width * .07); x < width * .93; x += 3)
      if (pixels[y * width + x] < 135) points.push([x - width / 2, y - height / 2]);
  if (points.length < 150) return 0;
  const score = (angle: number) => {
    const rad = angle * Math.PI / 180, sin = Math.sin(rad), cos = Math.cos(rad);
    const rows = new Uint32Array(height + width + 20);
    for (const [x, y] of points) { const row = Math.round(sin * x + cos * y + rows.length / 2); if (row >= 0 && row < rows.length) rows[row]++; }
    return rows.reduce((sum, n) => sum + n * n, 0);
  };
  const baseline = score(0); let best = baseline, angle = 0;
  for (let a = -5; a <= 5; a += .5) { const current = score(a); if (current > best) { best = current; angle = a; } }
  return best > baseline * 1.12 && Math.abs(angle) >= .5 && Math.abs(angle) < 5 ? angle : 0;
}

/** Metadata only: archival bytes and duplicate fingerprints are never rewritten here. */
export async function prepareScanHeaders(image: string, dir: string): Promise<{ images: string[]; adjusted: boolean }> {
  const input = sharp(image, { limitInputPixels: 24_000_000 }).rotate().flatten({ background: "white" });
  const initial = await input.resize({ width: 2200, height: 3000, fit: "inside", withoutEnlargement: true }).grayscale().png().toBuffer();
  const orientationFile = join(dir, "orientation.png"); await sharp(initial).toFile(orientationFile);
  let rotation = 0;
  try {
    const result = await exec("tesseract", [orientationFile, "stdout", "-l", "osd", "--psm", "0"], { timeout: 6000, killSignal: "SIGKILL", maxBuffer: 100_000, env: { ...process.env, OMP_THREAD_LIMIT: "1" } });
    const report = `${result.stdout}\n${result.stderr}`;
    const confidence = Number(report.match(/Orientation confidence:\s*([\d.]+)/)?.[1] ?? 0);
    const correction = Number(report.match(/Rotate:\s*(\d+)/)?.[1] ?? 0);
    if (confidence >= 2.5 && [90,180,270].includes(correction)) rotation = correction;
  } catch { /* Sparse headers may not contain enough text for OSD. Original layouts remain available. */ }
  const oriented = await sharp(initial).rotate(rotation, { background: "white" }).png().toBuffer();
  const sample = await sharp(oriented).resize({ width: 700, withoutEnlargement: true }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const skew = estimateSkew(sample.data, sample.info.width, sample.info.height);
  const upright = await sharp(oriented).rotate(skew, { background: "white" }).png().toBuffer();
  const meta = await sharp(upright).metadata(); const width = meta.width!, height = meta.height!;
  const images: string[] = [];
  // Compare the unaltered upright header with a light-cleaned version. 60% is
  // only a taller fallback region, not a claim that every header is at the top.
  for (const [index, fraction, clean] of [[0,.4,false],[1,.4,true],[2,.6,true]] as const) {
    const path = join(dir, `prepared-${index}.png`);
    let crop = sharp(upright).extract({ left: 0, top: 0, width, height: Math.max(1, Math.round(height * fraction)) });
    if (clean) crop = crop.normalise({ lower: 1, upper: 99 }).sharpen({ sigma: .5 });
    await crop.png().toFile(path); images.push(path);
  }
  // Phone perspective means one global angle may not align every printed row.
  // Compare two bounded header-only angle brackets rather than guessing a value.
  if (skew) for (const delta of [-1, 1]) {
    const path = join(dir, `prepared-bracket-${delta}.png`);
    await sharp(upright).extract({ left: 0, top: 0, width, height: Math.round(height * .6) })
      .normalise({ lower: 1, upper: 99 }).sharpen({ sigma: .5 })
      .rotate(delta, { background: "white" }).png().toFile(path);
    images.push(path);
  }
  return { images, adjusted: Boolean(rotation || skew) };
}
