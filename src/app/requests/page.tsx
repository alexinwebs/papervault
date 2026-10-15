import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { subjectHref, uploadHref } from "@/lib/links";
import { wantedPapers } from "@/server/services/requests";
import { EmptyState, PageHeading, Panel } from "@/components/ui";
import { ShareButton } from "@/components/ShareButton";

export const metadata: Metadata = { title: "Papers wanted", description: "Help your batch: find requested past papers and contribute a copy you are allowed to share.", robots: { index: false } };

export default async function RequestsPage({ searchParams }: {
  searchParams: Promise<{ college?: string }>;
}) {
  const raw = (await searchParams).college;
  const slug = typeof raw === "string" ? raw.slice(0, 160) : "";
  const colleges = await prisma.college.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, shortName: true, name: true } });
  const selected = colleges.find(c => c.slug === slug);
  // An invalid campus must not silently broaden the board to other colleges.
  const wanted = slug && !selected ? [] : await wantedPapers(selected?.slug);
  const path = selected ? `/requests?college=${encodeURIComponent(selected.slug)}` : "/requests";
  return <div className="flex min-w-0 flex-col gap-5">
    <PageHeading eyebrow="Help your batch" title="Papers wanted" description="Have one of these past papers? Share a permitted copy so classmates do not have to keep asking in group chats. No upload is required to read public papers." aside={<ShareButton path={path} title={selected ? `${selected.shortName} · Papers wanted` : "PaperVault · Papers wanted"} />} />
    <Panel className="p-4">
      <form action="/requests" method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1"><label htmlFor="request-college" className="pv-label">College</label>
          <select id="request-college" name="college" defaultValue={selected?.slug ?? ""} className="pv-input">
            <option value="">All colleges</option>{colleges.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select></div>
        <button className="pv-btn-primary" type="submit">Show requests</button>
      </form>
    </Panel>
    <p className="text-sm text-ink/70">Counts represent accounts that requested a subject, exam type and year—not a promise of authenticity or a specific ST-1/ST-2 session. Open the subject to check details. The board checks the 100 most-requested groups; filter by college for a narrower view.</p>
    {wanted.length ? <ul className="grid min-w-0 gap-3 lg:grid-cols-2">{wanted.map(({ subject, examType, academicYear, requests }) => {
      const branch = subject.semester.branch, program = branch.program, college = program.college;
      const href = subjectHref(college.slug, program.slug, branch.slug, subject.semester.number, subject.slug);
      return <li key={`${subject.id}-${examType.id}-${academicYear}`} className="pv-panel min-w-0 p-4" data-testid="wanted-paper">
        <p className="text-xs text-ink/70">{college.shortName} · {program.name} {branch.code} · Semester {subject.semester.number}</p>
        <h2 className="mt-2 break-words font-mono text-base font-bold"><Link href={href} className="pv-link">{subject.name}</Link></h2>
        <p className="mt-1 text-sm">{subject.code} · {examType.name} · {academicYear}</p>
        <p className="mt-2 text-sm">Requested by {requests} {requests === 1 ? "account" : "accounts"}.</p>
        <Link className="pv-btn-primary mt-3" href={uploadHref({ subjectId: subject.id, examType: examType.code, year: academicYear })}>I have this paper</Link>
      </li>;
    })}</ul> : <EmptyState title={slug && !selected ? "College not found." : "No open requests in this view."} body="Browse a subject, choose an exam type and request a past paper. A pending upload does not count as available until it is published." action={<Link href="/colleges" className="pv-btn-primary">Find your college</Link>} />}
    <p className="text-xs text-ink/70">Only upload past or officially released material you are allowed to share. Every submission still needs review.</p>
  </div>;
}
