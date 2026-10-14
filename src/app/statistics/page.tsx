import Link from "next/link";
import type { Metadata } from "next";
import { CoverageBar, EmptyState, PageHeading, Panel, SectionHeader, StatsCard } from "@/components/ui";
import { branchCoverage, platformStats, popularColleges, topContributors } from "@/server/services/stats";
import { prisma } from "@/lib/db";
import { PUBLIC_PAPER_WHERE } from "@/server/repositories/papers";
import { collegeHref } from "@/lib/links";
import { formatCount } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Statistics",
  description: "Live archive statistics for PaperVault: colleges, papers, contributors and coverage.",
};

export const revalidate = 300;

export default async function StatisticsPage() {
  const [stats, colleges, contributors, byExamType, byYear] = await Promise.all([
    platformStats(),
    popularColleges(6),
    topContributors(10),
    prisma.examType.findMany({
      select: {
        name: true,
        code: true,
        college: { select: { shortName: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.examSession.groupBy({
      by: ["academicYear"],
      _count: { _all: true },
      orderBy: { academicYear: "desc" },
      take: 8,
    }),
  ]);

  const published = await prisma.paper.count({ where: PUBLIC_PAPER_WHERE });
  const leader = colleges[0];
  const coverage = leader ? await branchCoverage(leader.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Archive health"
        title="Statistics"
        description="Every number here is computed from the database, not hardcoded."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard value={formatCount(stats.colleges)} label="Colleges" />
        <StatsCard value={formatCount(published)} label="Published papers" />
        <StatsCard value={formatCount(stats.students)} label="Registered students" />
        <StatsCard value={formatCount(stats.contributors)} label="Contributors" />
      </div>

      <section>
        <SectionHeader title="Papers by college" href="/colleges" />
        <Panel className="px-4 py-4">
          <ul className="flex flex-col gap-2">
            {colleges.map((college) => (
              <li key={college.id} className="flex flex-wrap items-center gap-3">
                <Link
                  href={collegeHref(college.slug)}
                  prefetch={false}
                  className="pv-link w-64 max-w-full min-w-0 shrink-0 font-mono text-sm"
                >
                  <span className="truncate">{college.name}</span>
                </Link>
                <CoverageBar percent={published === 0 ? 0 : (college.papers / published) * 100} />
                <span className="font-mono text-xs">{college.papers}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      {leader ? (
        <section>
          <SectionHeader title={`Coverage — ${leader.shortName}`} href={collegeHref(leader.slug)} />
          <Panel className="px-4 py-4">
            <ul className="flex flex-col gap-2">
              {coverage.map((row) => (
                <li key={row.branch.id} className="flex flex-wrap items-center gap-3">
                  <span className="w-56 max-w-full shrink-0 font-mono text-sm">
                    {row.branch.program.name} {row.branch.code}
                  </span>
                  <CoverageBar percent={row.percent} />
                  <span className="font-mono text-xs">{row.percent}%</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Exam sessions by year" />
          <Panel className="px-4 py-4">
            <ul className="flex flex-col gap-2">
              {byYear.map((row) => (
                <li key={row.academicYear} className="flex items-center gap-3">
                  <span className="w-16 font-mono text-sm">{row.academicYear}</span>
                  <CoverageBar
                    percent={(row._count._all / Math.max(...byYear.map((r) => r._count._all))) * 100}
                  />
                  <span className="font-mono text-xs">{row._count._all}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section>
          <SectionHeader title="Exam types" />
          <Panel className="px-4 py-4">
            <ul className="flex flex-col gap-2 font-mono text-xs">
              {byExamType.map((t) => (
                <li key={`${t.college.shortName}-${t.code}`} className="flex min-w-0 justify-between gap-2">
                  <span className="min-w-0 break-words">
                    {t.college.shortName} · {t.name}
                  </span>
                  <span className="shrink-0">{t._count.sessions} sessions</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      </div>

      <section>
        <SectionHeader title="Historical question intelligence" />
        <Panel className="bg-blue-soft px-4 py-4">
          <p className="text-sm">
            Question-level indexing (paper → question → topic → unit → curriculum) is modelled in the
            schema but not yet populated. When OCR and question extraction are in place, this section
            will show how often each topic has actually appeared — historical analysis only, never
            exam prediction.
          </p>
        </Panel>
      </section>

      <section>
        <SectionHeader title="Top contributors" />
        {contributors.length === 0 ? (
          <EmptyState title="No published contributions yet." />
        ) : (
          <Panel className="px-4 py-4">
            <ol className="flex flex-col gap-2">
              {contributors.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-ink/60">{i + 1}</span>
                  <Link
                    href={`/contributors/${c.id}`}
                    prefetch={false}
                    className="pv-link min-w-0 flex-1 font-sans text-sm"
                  >
                    <span className="truncate">{c.name}</span>
                  </Link>
                  <span className="font-mono text-xs">{c.papers} papers</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </section>
    </div>
  );
}
