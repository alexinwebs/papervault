import Link from "next/link";
import type { ReactNode } from "react";
import { BackButton } from "@/components/BackButton";

// Contact details come from the environment at request time, not build time.
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/guidelines", label: "Guidelines" },
  { href: "/legal/academic-integrity", label: "Academic integrity" },
  { href: "/legal/takedown", label: "Copyright & takedown" },
  { href: "/legal/report-content", label: "Report content" },
  { href: "/legal/data-rights", label: "Data rights" },
  { href: "/legal/teacher-verification", label: "Teacher verification" },
  { href: "/legal/contact", label: "Contact" },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/" />
        <nav aria-label="Legal" className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className="pv-chip bg-cream hover:bg-yellow"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <article className="pv-panel prose-legal flex flex-col gap-4 px-5 py-5">
        {children}
      </article>
    </div>
  );
}
