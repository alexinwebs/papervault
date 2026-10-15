import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/utils";
import { BackButton } from "./BackButton";

export const ACCENTS = {
  blue: "bg-blue-light",
  mint: "bg-mint",
  pink: "bg-pink",
  lavender: "bg-lavender",
  yellow: "bg-yellow",
  cream: "bg-cream",
} as const;
export type Accent = keyof typeof ACCENTS;

export function Panel({
  children,
  className,
  id,
  as: Tag = "section",
  testId,
}: {
  children: ReactNode;
  className?: string;
  /** Lets a panel be an in-page anchor target, e.g. `#sem-5`. */
  id?: string;
  as?: "section" | "div" | "aside" | "article";
  /** Stable hook for end-to-end tests. */
  testId?: string;
}) {
  return (
    <Tag id={id} className={cx("pv-panel", className)} data-testid={testId}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  href,
  hrefLabel = "View all",
  icon,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <h2 className="pv-section-title min-w-0 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {href ? (
        <Link href={href} prefetch={false} className="pv-link shrink-0 font-mono text-xs">
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}

export function StatsCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="pv-panel-flat bg-paper px-3 py-3 text-center">
      <div className="font-mono text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 font-sans text-[11px] uppercase tracking-wide text-ink/60">{label}</div>
    </div>
  );
}

export function Chip({
  children,
  accent = "cream",
  className,
}: {
  children: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return <span className={cx("pv-chip", ACCENTS[accent], className)}>{children}</span>;
}

export function EmptyState({
  title,
  body,
  action,
  media,
  as = "p",
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  /** Optional artwork above the title, e.g. the logo mark on the 404 page. */
  media?: ReactNode;
  /** Promote the title to a real heading when the empty state owns the page. */
  as?: "p" | "h1" | "h2";
}) {
  const Title = as;
  return (
    <div className="pv-panel-flat border-dashed bg-paper px-5 py-10 text-center sm:px-6">
      {media ? <div className="mb-4 flex justify-center">{media}</div> : null}
      <Title className="font-mono text-base font-bold">{title}</Title>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">{body}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="pv-panel-flat bg-pink px-6 py-8 text-center">
      <p className="font-mono text-base font-bold">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-ink/80">{body}</p> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse border-2 border-ink/20 bg-ink/5 rounded-sm", className)} />;
}

export function Breadcrumbs({
  items,
  back,
}: {
  items: Array<{ label: string; href?: string }>;
  /** Parent used when there is no in-app history. Defaults to the nearest linked crumb; `false` hides Back. */
  back?: string | false;
}) {
  const fallback = back === false ? null : (back ?? [...items].reverse().find((item) => item.href)?.href ?? null);
  return (
    <div className="mb-3 flex items-center gap-3">
      {fallback ? <BackButton fallback={fallback} /> : null}
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink/60">
        {items.map((item, i) => (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {item.href ? (
              <Link prefetch={false}
                href={item.href}
                // Breadcrumb type is deliberately small; the link keeps a 24px
                // tall hit area so it is still a comfortable phone target.
                className="inline-flex min-h-[24px] items-center underline decoration-1 underline-offset-2 hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-ink">{item.label}</span>
            )}
            {i < items.length - 1 ? <span aria-hidden>/</span> : null}
          </span>
        ))}
      </nav>
    </div>
  );
}

/** Back control for deeper pages that have no breadcrumb trail. */
export function BackBar({ fallback }: { fallback: string }) {
  return (
    <div className="mb-1">
      <BackButton fallback={fallback} />
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="pv-eyebrow">{eyebrow}</p> : null}
        <h1 className="pv-h2 mt-1">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink/70">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function CoverageBar({ percent }: { percent: number }) {
  const blocks = 18;
  const filled = Math.round((percent / 100) * blocks);
  return (
    <span className="font-mono text-xs" aria-hidden>
      {"█".repeat(filled)}
      <span className="text-ink/25">{"░".repeat(Math.max(0, blocks - filled))}</span>
    </span>
  );
}

/**
 * Page links for the admin tables. Rendered as plain anchors that preserve the
 * current filters, so it works without JavaScript and survives a full reload.
 */
export function Pagination({
  page,
  pages,
  total,
  perPage,
  params,
  label = "results",
}: {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  /** Current query string, without the page parameter. */
  params: Record<string, string | undefined>;
  label?: string;
}) {
  if (total === 0) return null;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `?${qs}` : "?";
  };

  // Query pagination uses ordinary document navigation: it works before hydration
  // and avoids a stalled client-router Flight response leaving old results visible.
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-[11px] text-ink/60" data-testid="pagination-summary">
        {first}–{last} of {total} {label}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <a href={href(page - 1)} className="pv-btn-secondary px-3 py-1 text-[11px]">
              Previous
            </a>
          ) : (
            <span className="px-3 py-1 font-mono text-[11px] text-ink/35">Previous</span>
          )}
          <span className="font-mono text-[11px]" data-testid="pagination-position">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <a href={href(page + 1)} className="pv-btn-secondary px-3 py-1 text-[11px]">
              Next
            </a>
          ) : (
            <span className="px-3 py-1 font-mono text-[11px] text-ink/35">Next</span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
