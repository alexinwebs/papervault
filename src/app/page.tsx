import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, FileText, Users } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CollegeCard } from "@/components/CollegeCard";
import { PaperList } from "@/components/PaperRow";
import { EmptyState, Panel, SectionHeader, StatsCard } from "@/components/ui";
import { platformStats, popularColleges, topContributors } from "@/server/services/stats";
import { recentPublishedPapers } from "@/server/repositories/papers";
import { LogoWordmark } from "@/components/Brand";
import { formatCount } from "@/lib/utils";

export const revalidate = 60;

export default async function HomePage() {
  const [stats, colleges, recent, contributors] = await Promise.all([
    platformStats(),
    popularColleges(4),
    recentPublishedPapers(4),
    topContributors(5),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Hero */}
      <Panel className="bg-blue-light px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {/* The official wordmark already carries the tagline, so the
                previous eyebrow line would just repeat it. */}
            <LogoWordmark width={300} priority className="max-w-full" />
            <h1 className="pv-h1 mt-5">
              Find.
              <br />
              Learn.
              <br />
              Contribute.
            </h1>
            <p className="mt-4 max-w-md font-mono text-sm leading-relaxed">
              A student-powered archive of question papers for engineering and higher-education
              colleges across India.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/colleges" className="pv-btn-primary">
                Search colleges
              </Link>
              <Link href="/search?q=" className="pv-btn-secondary">
                Explore papers
              </Link>
            </div>
            <div className="mt-5 max-w-xl lg:hidden">
              <Suspense fallback={null}>
                <GlobalSearch id="global-search-hero" />
              </Suspense>
            </div>
          </div>

          {/* Editorial paper stack */}
          <div className="relative hidden min-h-[240px] items-center justify-center lg:flex" aria-hidden>
            <div className="absolute right-16 top-8 h-44 w-36 rotate-[8deg] border-2 border-ink bg-blue-soft shadow-hard" />
            <div className="absolute right-24 top-4 h-44 w-36 rotate-[-4deg] border-2 border-ink bg-cream shadow-hard" />
            <div className="relative h-48 w-40 rotate-[3deg] border-2 border-ink bg-paper px-3 py-4 shadow-hard-lg">
              <p className="font-mono text-base font-bold leading-tight">
                PAST
                <br />
                PAPERS
                <br />
                BRIGHTER
                <br />
                FUTURES.
              </p>
              <span className="absolute bottom-3 left-3 font-mono text-[10px] tracking-[0.1em]">
                PAPER/VAULT
              </span>
            </div>
            <div className="absolute -top-2 right-0 w-36 border-2 border-ink bg-yellow px-3 py-2 font-mono text-[11px] font-bold uppercase leading-snug shadow-hard">
              Built by students for students. //
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section>
            <SectionHeader title="Popular colleges" href="/colleges" />
            {colleges.length === 0 ? (
              <EmptyState title="Nothing here yet." body="Colleges appear as soon as the archive has data." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {colleges.map((college) => (
                  <CollegeCard key={college.id} college={college} papers={college.papers} compact />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Recently added papers" href="/search?q=" />
            {recent.length === 0 ? (
              <EmptyState
                title="Be the first contributor."
                body="Published papers from your college will show up here."
                action={
                  <Link href="/upload" className="pv-btn-primary">
                    Upload a paper
                  </Link>
                }
              />
            ) : (
              <PaperList papers={recent} />
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel className="bg-yellow px-4 py-4">
            <h2 className="pv-section-title flex items-center gap-2">
              <BarChart3 className="h-4 w-4" aria-hidden /> Platform stats
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatsCard value={formatCount(stats.colleges)} label="Colleges" />
              <StatsCard value={formatCount(stats.papers)} label="Papers" />
              <StatsCard value={formatCount(stats.students)} label="Students" />
              <StatsCard value={formatCount(stats.contributors)} label="Contributors" />
            </div>
            <p className="mt-3 font-sans text-[11px] text-ink/60">
              Counts are read live from the database.
            </p>
          </Panel>

          <Panel className="bg-pink px-4 py-4">
            <h2 className="pv-section-title flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden /> Top contributors
            </h2>
            {contributors.length === 0 ? (
              <p className="mt-3 font-mono text-xs">No published contributions yet.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {contributors.map((c, i) => (
                  <li key={c.id} className="pv-row bg-paper">
                    <span className="font-mono text-xs text-ink/60">{i + 1}</span>
                    <Link
                      href={`/contributors/${c.id}`}
                      prefetch={false}
                      className="pv-link-title min-w-0 flex-1 font-sans text-sm"
                    >
                      {/* truncate needs to be on a child, not on the flex box */}
                      <span className="truncate">{c.name}</span>
                    </Link>
                    <span className="font-mono text-xs">{c.papers} papers</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel className="bg-mint px-4 py-4">
            <h2 className="pv-section-title flex items-center gap-2">
              <FileText className="h-4 w-4" aria-hidden /> Missing a paper?
            </h2>
            <p className="mt-2 text-sm text-ink/80">
              Search for it. If it is not in the archive yet, you can request it — or upload the copy
              you already have.
            </p>
            <Link href="/upload" className="pv-btn-primary mt-3">
              Contribute a paper
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}
