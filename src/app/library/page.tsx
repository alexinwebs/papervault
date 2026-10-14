import Link from "next/link";
import type { Metadata } from "next";
import { Chip, EmptyState, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { PaperList } from "@/components/PaperRow";
import { StatusChip } from "@/components/VerificationBadge";
import { getSessionUser } from "@/lib/auth";
import { myLibrary } from "@/server/services/library";
import { myPinnedColleges } from "@/server/services/pins";
import { PinCollegeButton } from "@/components/PinCollegeButton";
import { collegeHref } from "@/lib/links";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My library", robots: { index: false } };

export default async function LibraryPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading eyebrow="My library" title="Sign in to see your library" />
        <Link href="/login?next=/library" className="pv-btn-primary self-start">
          Sign in
        </Link>
      </div>
    );
  }

  const [{ saved, recent, uploads, requests }, pins] = await Promise.all([
    myLibrary(user.id),
    myPinnedColleges(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="My library" title={`Hello, ${user.name.split(" ")[0]}`} />

      <section id="my-colleges" className="scroll-mt-24">
        <SectionHeader title={`My Colleges (${pins.length})`} />
        <p className="-mt-1 mb-3 font-sans text-xs text-ink/60">Only you can see the colleges you pin.</p>
        {pins.length === 0 ? (
          <EmptyState
            title="No pinned colleges yet."
            body="Use Pin on any college to keep it one tap away in the menu."
            action={
              <Link href="/colleges" className="pv-btn-secondary">
                Explore colleges
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="my-colleges">
            {pins.map(({ college }) => (
              <li key={college.id}>
                <Panel className="flex items-center justify-between gap-3 px-3 py-2">
                  <Link href={collegeHref(college.slug)} prefetch={false} className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-bold">{college.name}</span>
                    <span className="block truncate font-sans text-xs text-ink/60">
                      {college.city}, {college.state}
                    </span>
                  </Link>
                  <PinCollegeButton
                    collegeId={college.id}
                    collegeName={college.name}
                    pinned
                    signedIn
                    size="sm"
                  />
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title={`Saved papers (${saved.length})`} />
        {saved.length === 0 ? (
          <EmptyState title="Nothing saved yet." body="Use Save on any paper to keep it here." />
        ) : (
          <PaperList papers={saved.map((b) => b.paper)} />
        )}
      </section>

      <section>
        <SectionHeader title="Recently viewed" />
        {recent.length === 0 ? (
          <EmptyState title="No views yet." />
        ) : (
          <PaperList papers={recent.map((v) => v.paper)} />
        )}
      </section>

      <section>
        <SectionHeader title={`My uploads (${uploads.length})`} />
        {uploads.length === 0 ? (
          <EmptyState
            title="Be the first contributor."
            body="Upload a past paper from your college and help the next batch."
            action={
              <Link href="/upload" className="pv-btn-primary">
                Upload a paper
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {uploads.map((paper) => (
              <li key={paper.id} className="pv-row flex-wrap justify-between">
                <span className="min-w-0">
                  <Link href={`/papers/${paper.id}`} className="block truncate font-mono text-sm font-bold underline decoration-1 underline-offset-2">
                    {paper.title}
                  </Link>
                  <span className="block font-sans text-[11px] text-ink/60">
                    {paper.paperSet.examSession.examType.name} · {paper.paperSet.examSession.academicYear} ·{" "}
                    uploaded {formatDate(paper.createdAt)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusChip status={paper.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title={`Requested papers (${requests.length})`} />
        {requests.length === 0 ? (
          <EmptyState title="No requests yet." body="Request a missing paper from any subject page." />
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((request) => {
              const branch = request.subject.semester.branch;
              return (
                <li key={request.id} className="pv-row flex-wrap justify-between">
                  <span>
                    <span className="block font-mono text-sm font-bold">{request.subject.name}</span>
                    <span className="block font-sans text-[11px] text-ink/60">
                      {branch.program.college.shortName} · {request.examType.name} · {request.academicYear}
                    </span>
                  </span>
                  <Chip accent={request.fulfilled ? "mint" : "yellow"}>
                    {request.fulfilled ? "In archive" : "Waiting"}
                  </Chip>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
