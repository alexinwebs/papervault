import Link from "next/link";
import type { Metadata } from "next";
import { CollegeCard } from "@/components/CollegeCard";
import { EmptyState, PageHeading, Panel } from "@/components/ui";
import { collegeSearchSchema } from "@/server/validators";
import { PAGE_SIZE, listColleges, collegeStates, publishedPaperCountForCollege } from "@/server/repositories/colleges";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { pinnedCollegeIds } from "@/server/services/pins";

export const metadata: Metadata = {
  title: "Explore colleges",
  description: "Browse colleges in the PaperVault archive by name, state, and program.",
};

export default async function CollegesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = collegeSearchSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : { page: 1 as const };

  const [[colleges, total], states, programs] = await Promise.all([
    listColleges(filters),
    collegeStates(),
    prisma.program.findMany({ distinct: ["slug"], select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const [counts, user] = await Promise.all([
    Promise.all(colleges.map((c) => publishedPaperCountForCollege(c.id))),
    getSessionUser(),
  ]);
  const pinned = await pinnedCollegeIds(user?.id, colleges.map((c) => c.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = filters.page ?? 1;
  const qs = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...raw, ...next })) {
      if (typeof v === "string" && v) params.set(k, v);
      if (typeof v === "number") params.set(k, String(v));
    }
    return `/colleges?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow="College discovery"
        title="Explore colleges"
        description="Start with your college, then walk down to the exact subject and exam."
      />

      <Panel className="px-4 py-4">
        <form className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" role="search">
          <div>
            <label className="pv-label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={typeof raw.q === "string" ? raw.q : ""}
              className="pv-input"
              placeholder="College, city, or university"
            />
          </div>
          <div>
            <label className="pv-label" htmlFor="state">
              State
            </label>
            <select id="state" name="state" className="pv-input" defaultValue={typeof raw.state === "string" ? raw.state : ""}>
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="pv-label" htmlFor="program">
              Program
            </label>
            <select id="program" name="program" className="pv-input" defaultValue={typeof raw.program === "string" ? raw.program : ""}>
              <option value="">All programs</option>
              {programs.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="pv-btn-primary">
            Filter
          </button>
          <label className="pv-checkbox-row font-mono text-[11px] uppercase tracking-[0.1em] sm:col-span-4">
            <input
              type="checkbox"
              name="verifiedOnly"
              value="true"
              defaultChecked={!!filters.verifiedOnly}
              className="pv-checkbox"
            />
            Verified colleges only
          </label>
        </form>
      </Panel>

      {colleges.length === 0 ? (
        <EmptyState
          title="No colleges matched."
          body="Try a shorter search, or clear the filters."
          action={
            <Link href="/colleges" className="pv-btn-secondary">
              Clear filters
            </Link>
          }
        />
      ) : (
        // A labelled section keeps the card <h3> titles from skipping a level.
        <section aria-labelledby="college-results">
          <h2 id="college-results" className="font-mono text-xs text-ink/60">
            {total} college{total === 1 ? "" : "s"} · page {page} of {pages}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {colleges.map((college, i) => (
              <CollegeCard
                key={college.id}
                college={college}
                papers={counts[i]}
                pin={{ pinned: pinned.has(college.id), signedIn: Boolean(user) }}
              />
            ))}
          </div>
          {pages > 1 ? (
            <nav className="mt-4 flex items-center gap-2" aria-label="Pagination">
              {page > 1 ? (
                <Link href={qs({ page: page - 1 })} className="pv-btn-secondary">
                  ← Previous
                </Link>
              ) : null}
              {page < pages ? (
                <Link href={qs({ page: page + 1 })} className="pv-btn-secondary">
                  Next →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
