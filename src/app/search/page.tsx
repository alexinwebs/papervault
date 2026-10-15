import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { pinnedCollegeIds } from "@/server/services/pins";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CollegeCard } from "@/components/CollegeCard";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PaperList } from "@/components/PaperRow";
import { Chip, EmptyState, PageHeading, Panel, Pagination, SectionHeader } from "@/components/ui";
import { searchEverything } from "@/server/services/search";
import { searchSchema } from "@/server/validators";
import { subjectHref, uploadHref } from "@/lib/links";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = searchSchema.safeParse(raw);
  const { q, page } = parsed.success ? parsed.data : { q: "", page: 1 };
  const [results, user] = await Promise.all([searchEverything(q, page), getSessionUser()]);
  const pinned = await pinnedCollegeIds(user?.id, results.colleges.map((c) => c.id));
  // One clear subject match: "I have this paper" opens the upload form filled in.
  const queryYear = results.tokens.map(Number).find((n) => n >= 1990 && n <= 2100);
  const haveHref =
    results.subjects.length === 1
      ? uploadHref({ subjectId: results.subjects[0].id, year: queryYear })
      : "/upload";

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow="Global search"
        title={q ? `Results for “${q}”` : "Find what they asked."}
        description="Search across colleges, branches, subjects, exam types and years — e.g. “RKGIT DBMS ST 2025”."
      />

      <Panel className="px-4 py-4">
        <Suspense fallback={null}>
          <GlobalSearch id="global-search-page" />
        </Suspense>
        {results.tokens.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {results.tokens.map((t) => (
              <Chip key={t} accent="blue">
                {t}
              </Chip>
            ))}
          </div>
        ) : null}
      </Panel>

      {!q ? (
        <>
        <EmptyState
          title="Start with your college or browse recent papers."
          body="Public papers are free to read without an account. Try a subject abbreviation, code, exam type or year."
          action={
            <Link href="/colleges" className="pv-btn-primary">
              Browse colleges instead
            </Link>
          }
        />
        <section><SectionHeader title={`Recent papers (${results.paperTotal})`} />
          <PaperList papers={results.papers} />
          <Pagination page={results.page} pages={results.pages} total={results.paperTotal} perPage={results.pageSize} params={{ q }} label="papers" />
        </section>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {results.colleges.length > 0 ? (
            <section>
              <SectionHeader title="Colleges" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.colleges.map((college) => (
                  <CollegeCard
                    key={college.id}
                    college={college}
                    papers={0}
                    compact
                    pin={{ pinned: pinned.has(college.id), signedIn: Boolean(user) }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {results.subjects.length > 0 ? (
            <section>
              <SectionHeader title="Subjects" />
              <ul className="flex flex-col gap-2">
                {results.subjects.map((subject) => {
                  const branch = subject.semester.branch;
                  const college = branch.program.college;
                  return (
                    <li key={subject.id}>
                      <Link
                        href={subjectHref(
                          college.slug,
                          branch.program.slug,
                          branch.slug,
                          subject.semester.number,
                          subject.slug,
                        )}
                        className="pv-row justify-between hover:bg-cream"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-sm font-bold">{subject.name}</span>
                          <span className="block font-sans text-[11px] text-ink/60">
                            {college.shortName} · {branch.program.name} {branch.code} · Semester{" "}
                            {subject.semester.number}
                          </span>
                        </span>
                        <span className="font-mono text-xs">Open →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {results.paperTotal === 0 ? <p className="text-sm text-ink/70">Try the printed subject code, remove a year filter, or <Link href="/requests" className="pv-link">see papers wanted</Link>. We do not substitute unrelated papers for a missing match.</p> : null}

          <section>
            <SectionHeader title={`Papers (${results.paperTotal})`} />
            {results.papers.length === 0 ? (
              <EmptyState
                title="Not in the archive yet."
                body="Open the subject page to request this paper, or upload the copy you have."
                action={
                  <Link href={haveHref} className="pv-btn-primary">
                    I have this paper
                  </Link>
                }
              />
            ) : (
              <>
                <PaperList papers={results.papers} />
                <div className="mt-4"><Pagination page={results.page} pages={results.pages} total={results.paperTotal} perPage={results.pageSize} params={{ q }} label="papers" /></div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
