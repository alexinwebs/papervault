import type { ReactNode } from "react";

/** Shared chrome for the policy pages so they read consistently. */
export function LegalDoc({
  title,
  updated,
  summary,
  children,
}: {
  title: string;
  updated: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b-2 border-ink pb-3">
        <p className="pv-eyebrow">Policy</p>
        <h1 className="pv-h2 mt-1">{title}</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/60">
          Last updated {updated}
        </p>
        <p className="mt-3 font-sans text-sm text-ink/80">{summary}</p>
      </header>
      <div className="flex flex-col gap-4 font-sans text-sm leading-relaxed text-ink/85">{children}</div>
      <p className="border-t-2 border-ink pt-3 font-mono text-[11px] text-ink/60">
        This template covers the common cases for a student-run archive. Have it reviewed by a
        lawyer in your jurisdiction before you launch publicly.
      </p>
    </>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="pv-section-title mb-1">{heading}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
