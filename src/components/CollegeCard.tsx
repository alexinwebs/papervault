import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { ACCENTS, type Accent } from "./ui";
import { PinCollegeButton } from "./PinCollegeButton";
import { collegeHref } from "@/lib/links";
import { cx, formatCount } from "@/lib/utils";

/**
 * The whole card is clickable through a stretched link on the title (its
 * ::after covers the card), which leaves room for an independent pin button:
 * a <button> nested inside an <a> is invalid and would trigger navigation.
 */
export function CollegeCard({
  college,
  papers,
  compact = false,
  pin,
}: {
  college: {
    id?: string;
    slug: string;
    name: string;
    shortName: string;
    city: string;
    state: string;
    verified: boolean;
    accent: string;
    programs: { slug: string; name: string }[];
  };
  papers: number;
  compact?: boolean;
  /** Pass to show the pin control; omit on surfaces that are not per-user. */
  pin?: { pinned: boolean; signedIn: boolean };
}) {
  const accent = (ACCENTS[college.accent as Accent] ?? ACCENTS.blue) as string;
  return (
    <div
      className={cx(
        "pv-card-interactive relative flex flex-col px-4 py-3 focus-within:-translate-y-[2px] focus-within:shadow-hard",
        accent,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-base font-bold leading-tight">
          <Link
            prefetch={false}
            href={collegeHref(college.slug)}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
          >
            {compact ? college.shortName : college.name}
          </Link>
        </h3>
        {college.verified ? (
          <BadgeCheck className="h-4 w-4 shrink-0" aria-label="Verified college" />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ink/70">
        {college.city}, {college.state}
      </p>
      {!compact && college.programs.length > 0 ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-ink/70">
          {college.programs.map((p) => p.name).join(" · ")}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-sm">{formatCount(papers)} papers</span>
        <span className="flex items-center gap-2">
          {pin && college.id ? (
            <PinCollegeButton
              collegeId={college.id}
              collegeName={college.name}
              pinned={pin.pinned}
              signedIn={pin.signedIn}
              size="sm"
              // Above the stretched link so it receives its own clicks.
              className="relative z-10"
            />
          ) : null}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </div>
  );
}
