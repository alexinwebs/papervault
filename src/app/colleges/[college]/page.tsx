import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, MapPin } from "lucide-react";
import { Breadcrumbs, CoverageBar, EmptyState, Panel, SectionHeader, StatsCard } from "@/components/ui";
import { PaperList } from "@/components/PaperRow";
import { prisma } from "@/lib/db";
import { collegeBySlug, contributorCountForCollege, publishedPaperCountForCollege, publishedPaperWhereForCollege } from "@/server/repositories/colleges";
import { paperCardInclude } from "@/server/repositories/papers";
import { branchCoverage } from "@/server/services/stats";
import { branchHref, programHref } from "@/lib/links";
import { formatCount } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { pinnedCollegeIds } from "@/server/services/pins";
import { PinCollegeButton } from "@/components/PinCollegeButton";

type Params = { params: Promise<{ college: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { college: slug } = await params;
  const college = await prisma.college.findUnique({ where: { slug } });
  if (!college) return { title: "College not found" };
  return {
    title: college.name,
    description: `Question papers from ${college.name}, ${college.city} — programs, branches, semesters and subjects in the PaperVault archive.`,
    alternates: { canonical: `/colleges/${college.slug}` },
  };
}

export default async function CollegePage({ params }: Params) {
  const { college: slug } = await params;
  const college = await collegeBySlug(slug);
  if (!college) notFound();

  const [papers, contributors, coverage, recent, user] = await Promise.all([
    publishedPaperCountForCollege(college.id),
    contributorCountForCollege(college.id),
    branchCoverage(college.id),
    prisma.paper.findMany({
      where: publishedPaperWhereForCollege(college.id),
      include: paperCardInclude,
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
    getSessionUser(),
  ]);
  const pinned = (await pinnedCollegeIds(user?.id, [college.id])).has(college.id);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Colleges", href: "/colleges" }, { label: college.shortName }]} />

      <Panel className="bg-blue-light px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="pv-h2">{college.name}</h1>
            <p className="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em]">
              <MapPin className="h-3 w-3" aria-hidden /> {college.city}, {college.state}
            </p>
            <p className="mt-1 font-sans text-sm text-ink/70">{college.university}</p>
            {college.about ? <p className="mt-3 max-w-2xl text-sm">{college.about}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {college.verified ? (
              <span className="pv-chip bg-mint">
                <BadgeCheck className="h-3 w-3" aria-hidden /> Verified college
              </span>
            ) : null}
            <PinCollegeButton
              collegeId={college.id}
              collegeName={college.name}
              pinned={pinned}
              signedIn={Boolean(user)}
            />
          </div>
        </div>
        <div className="mt-4 grid max-w-md grid-cols-3 gap-3">
          <StatsCard value={formatCount(papers)} label="Papers" />
          <StatsCard value={formatCount(contributors)} label="Contributors" />
          <StatsCard value={String(college.programs.length)} label="Programs" />
        </div>
      </Panel>

      <section>
        <SectionHeader title="Programs" />
        {college.programs.length === 0 ? (
          <EmptyState title="No programs configured yet." body="A college admin can add programs and branches." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {college.programs.map((program) => (
              <Link
                key={program.id}
                href={programHref(college.slug, program.slug)}
                className="pv-card-interactive block px-4 py-3"
              >
                <h3 className="font-mono text-base font-bold">{program.name}</h3>
                <p className="mt-1 text-xs text-ink/70">
                  {program.branches.length} branch{program.branches.length === 1 ? "" : "es"} ·{" "}
                  {program.semesterCount} semesters
                </p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-ink/60">
                  {program.branches.slice(0, 4).map((b) => b.code).join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Archive coverage" />
        <Panel className="px-4 py-4">
          <p className="mb-3 font-sans text-xs text-ink/60">
            Share of subject × exam × year slots from the last three academic years that have at least
            one published paper.
          </p>
          <ul className="flex flex-col gap-2">
            {coverage.map((row) => (
              <li key={row.branch.id} className="flex flex-wrap items-center gap-3">
                <Link
                  href={branchHref(college.slug, row.branch.program.slug, row.branch.slug)}
                  prefetch={false}
                  className="pv-link w-56 shrink-0 font-mono text-sm"
                >
                  {row.branch.program.name} {row.branch.code}
                </Link>
                <CoverageBar percent={row.percent} />
                <span className="font-mono text-xs">{row.percent}%</span>
                <span className="font-sans text-[11px] text-ink/50">
                  {row.filled}/{row.slots} slots
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section>
        <SectionHeader title="Recent papers" />
        {recent.length === 0 ? (
          <EmptyState
            title="Nothing published yet."
            body="Be the first contributor for this college."
            action={
              <Link href="/upload" className="pv-btn-primary">
                Upload a paper
              </Link>
            }
          />
        ) : (
          <PaperList papers={recent} showCollege={false} />
        )}
      </section>
    </div>
  );
}
