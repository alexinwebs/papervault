import Image from "next/image";
import Link from "next/link";
import { cx } from "@/lib/utils";

/**
 * Single source of truth for the PaperVault logo.
 *
 * Both files are the official artwork, exported straight from the supplied
 * originals — only uniform black padding was trimmed and re-added so the marks
 * sit on a predictable canvas. Never recolour, stretch, crop or redraw them.
 *
 * The artwork sits on a solid black field. Our `ink`/`navy` token is #00002A,
 * which reads as the same near-black, so rendering the asset on a navy tile
 * makes the artwork's own background disappear into the tile edge.
 */
const MARK_SRC = "/brand/papervault-mark.png";
const MARK_SIZE = 512;

const WORDMARK_SRC = "/brand/papervault-wordmark.png";
const WORDMARK_W = 1053;
const WORDMARK_H = 613;

/** Square "P" monogram, framed as a hard-edged tile. */
export function LogoMark({
  size = 40,
  className,
  priority = false,
  elevated = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  elevated?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border-2 border-ink bg-navy",
        elevated && "shadow-hard-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={MARK_SRC}
        alt=""
        width={MARK_SIZE}
        height={MARK_SIZE}
        priority={priority}
        sizes={`${size}px`}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/** Full wordmark including the official "your college. your papers." tagline. */
export function LogoWordmark({
  width = 320,
  className,
  priority = false,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cx("inline-block overflow-hidden rounded-sm border-2 border-ink bg-navy", className)}
      style={{ width }}
    >
      <Image
        src={WORDMARK_SRC}
        alt="PaperVault — your college, your papers."
        width={WORDMARK_W}
        height={WORDMARK_H}
        priority={priority}
        sizes={`${width}px`}
        className="h-auto w-full"
      />
    </span>
  );
}

/** Mark + typeset name, linked home. Used in the sidebar and drawer. */
export function BrandLockup({
  stacked = false,
  markSize = 40,
  className,
  priority = false,
}: {
  stacked?: boolean;
  markSize?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link href="/" aria-label="PaperVault home" className={cx("flex items-center gap-2 no-underline", className)}>
      <LogoMark size={markSize} priority={priority} elevated />
      <span className="font-mono text-xl font-bold leading-[1.05] tracking-tight">
        PAPER
        {stacked ? <br /> : "/"}
        VAULT
      </span>
    </Link>
  );
}
