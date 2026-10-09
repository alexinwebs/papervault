import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackBar, Chip, Panel, SectionHeader } from "@/components/ui";
import { PaperViewer } from "@/components/PaperViewer";
import { ModerationPanel } from "@/components/ModerationActions";
import { SoftDeleteForm } from "../recycle-bin/forms";
import { StatusChip, VerificationBadge } from "@/components/VerificationBadge";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Forbidden } from "@/components/Forbidden";
import { assertCollegeScope, canModerate } from "@/server/authz";
import { paperById } from "@/server/repositories/papers";
import { collegeIdOfPaper, findDuplicateCandidates } from "@/server/services/papers";
import { paperContext } from "@/lib/links";
import { formatBytes, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Review paper", robots: { index: false } };

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ paperId: string }>;
  searchParams: Promise<{ decided?: string }>;
}) {
  const { paperId } = await params;
  const { decided } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/moderation/${paperId}`);
  if (!canModerate(user.role)) return <Forbidden area="Moderation" />;
  const paper = await paperById(paperId);
  if (!paper) notFound();

  assertCollegeScope(user, collegeIdOfPaper(paper));
  const ctx = paperContext(paper);
  const file = paper.files[0];

  const [duplicates, uploaderStats] = await Promise.all([
    file
      ? findDuplicateCandidates({
          sha256: (await prisma.paperFile.findUnique({ where: { id: file.id }, select: { sha256: true } }))!.sha256,
          examSessionId: paper.paperSet.examSession.id,
          setLabel: paper.paperSet.label,
        })
      : Promise.resolve([]),
    prisma.paper.count({ where: { uploadedById: paper.uploadedById, status: "PUBLISHED" } }),
  ]);

  const otherCandidates = duplicates.filter((d) => d.id !== paper.id);

  return (
    <div className="flex flex-col gap-5">
      <BackBar fallback="/moderation" />
      {decided ? (
        <p role="status" className="pv-panel-flat bg-mint px-3 py-2 font-mono text-xs">
          Paper is now {decided.replace(/_/g, " ").toLowerCase()}.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="pv-eyebrow">Review</p>
          <h1 className="pv-h2 mt-1">{paper.title}</h1>
          <p className="mt-1 font-mono text-xs">{ctx.breadcrumbLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={paper.status} />
          <VerificationBadge verification={paper.verification} restricted={paper.restricted} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          {file ? (
            <PaperViewer
              fileUrl={`/api/files/${file.id}`}
              downloadUrl={`/api/files/${file.id}?download=1`}
              mimeType={file.mimeType}
              fileName={`${paper.title} — ${ctx.examType.code} ${ctx.academicYear}`}
            />
          ) : (
            <Panel className="bg-pink px-4 py-4 font-mono text-sm">No file attached.</Panel>
          )}

          <Panel className="px-4 py-4">
            <SectionHeader title="Submission history" />
            <ol className="flex flex-col gap-2 font-mono text-xs">
              {paper.events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-1">
                  <span>
                    {event.fromState ? `${event.fromState.toLowerCase()} → ` : ""}
                    {event.toState.toLowerCase()}
                  </span>
                  <span className="text-ink/60">{formatDate(event.createdAt)}</span>
                  {event.note ? <span className="w-full font-sans text-[11px] text-ink/70">{event.note}</span> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel className="px-4 py-4">
            <SectionHeader title="Decision" />
            <ModerationPanel paperId={paper.id} status={paper.status} duplicates={otherCandidates} classification={paper.examClassification} />
          </Panel>

          <Panel className="flex flex-col gap-2 border-pink bg-pink/30 px-4 py-4">
            <SectionHeader title="Remove from the archive" />
            <p className="font-sans text-xs text-ink/75">
              Use this for takedown notices and material that should never have been published.
              The paper leaves every listing immediately and can be restored from the{" "}
              <Link href="/moderation/recycle-bin" prefetch={false} className="pv-link">
                recycle bin
              </Link>{" "}
              for 30 days.
            </p>
            <SoftDeleteForm paperId={paper.id} />
          </Panel>

          <Panel className="px-4 py-4">
            <SectionHeader title="Metadata" />
            <dl className="flex flex-col gap-2 font-sans text-sm">
              {[
                ["College", ctx.college.name],
                ["Program / branch", `${ctx.program.name} ${ctx.branch.code}`],
                ["Semester", `Semester ${ctx.semesterNumber}`],
                ["Subject", `${ctx.subject.name} (${ctx.subject.code})`],
                ["Exam", `${ctx.examType.name} · ${ctx.academicYear} · ${ctx.setLabel}`],
                ["Uploader", `${paper.uploadedBy.name} · ${uploaderStats} published`],
                ["Uploaded", formatDate(paper.createdAt)],
                ...(file ? [["File", `${file.mimeType} · ${formatBytes(file.sizeBytes)}`]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-ink/10 pb-1">
                  <dt className="pv-eyebrow">{label}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel className="px-4 py-4">
            <SectionHeader title={`Duplicate candidates (${otherCandidates.length})`} />
            {otherCandidates.length === 0 ? (
              <p className="font-mono text-xs">No file-hash or metadata matches.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {otherCandidates.map((d) => (
                  <li key={d.id} className="pv-row justify-between">
                    <Link href={`/moderation/${d.id}`} prefetch={false} className="pv-link font-mono text-xs">
                      {d.title}
                    </Link>
                    <Chip accent={d.match === "FILE_HASH" ? "pink" : "yellow"}>{d.match.toLowerCase()}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="px-4 py-4">
            <SectionHeader title={`Reports (${paper.reports.length})`} />
            {paper.reports.length === 0 ? (
              <p className="font-mono text-xs">No reports.</p>
            ) : (
              <ul className="flex flex-col gap-1 font-mono text-xs">
                {paper.reports.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.reason.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="text-ink/60">{r.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
