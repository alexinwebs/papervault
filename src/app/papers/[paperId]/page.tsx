import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Breadcrumbs, Chip, EmptyState, Panel, SectionHeader } from "@/components/ui";
import { PaperViewer } from "@/components/PaperViewer";
import { BookmarkButton, ReportDialog } from "@/components/PaperActions";
import { PaperList } from "@/components/PaperRow";
import { StatusChip, VerificationBadge } from "@/components/VerificationBadge";
import { paperById, relatedPapers } from "@/server/repositories/papers";
import { collegeIdOfPaper, trackView } from "@/server/services/papers";
import { canViewPaperFile, isStaff } from "@/server/authz";
import { getSessionUser } from "@/lib/auth";
import { canModerate } from "@/server/authz";
import { Discussion, type DiscussionComment } from "@/components/Discussion";
import { listComments } from "@/server/services/comments";
import { prisma } from "@/lib/db";
import { paperContext, collegeHref } from "@/lib/links";
import { formatBytes, formatDate } from "@/lib/utils";

type Params = {
  params: Promise<{ paperId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { paperId } = await params;
  const paper = await paperById(paperId);
  if (!paper || paper.status !== "PUBLISHED" || paper.restricted) {
    return { title: "Paper", robots: { index: false } };
  }
  const ctx = paperContext(paper);
  return {
    title: `${paper.title} · ${ctx.examType.name} ${ctx.academicYear}`,
    description: `${paper.title} question paper — ${ctx.examType.name}, ${ctx.academicYear}, ${ctx.program.name} ${ctx.branch.code}, Semester ${ctx.semesterNumber}, ${ctx.college.name}.`,
    alternates: { canonical: `/papers/${paper.id}` },
  };
}

const COMMENT_FLASH: Record<string, string> = {
  removed: "Comment removed.",
  updated: "Comment updated.",
};

export default async function PaperPage({ params, searchParams }: Params) {
  const { paperId } = await params;
  const flashKey = String((await searchParams)?.comment ?? "");
  const flash = COMMENT_FLASH[flashKey] ?? null;
  const [paper, user] = await Promise.all([paperById(paperId), getSessionUser()]);
  if (!paper) notFound();

  const ctx = paperContext(paper);
  const collegeId = collegeIdOfPaper(paper);
  const allowed = canViewPaperFile(
    { status: paper.status, restricted: paper.restricted, uploadedById: paper.uploadedById, collegeId },
    user,
  );

  if (user && paper.status === "PUBLISHED" && !paper.restricted) {
    await trackView(user.id, paper.id);
  }

  const [related, bookmark] = await Promise.all([
    relatedPapers(paper.id, ctx.subject.id, 5),
    user
      ? prisma.bookmark.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.id } } })
      : Promise.resolve(null),
  ]);

  const file = paper.files[0];

  const comments = await listComments(paper.id);
  const discussion: DiscussionComment[] = comments.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() ?? null,
    replies: comment.replies.map((reply) => ({
      ...reply,
      createdAt: reply.createdAt.toISOString(),
      editedAt: reply.editedAt?.toISOString() ?? null,
      replies: [],
    })),
  }));

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: "Colleges", href: "/colleges" },
          { label: ctx.college.shortName, href: collegeHref(ctx.college.slug) },
          { label: ctx.subject.code, href: ctx.subjectUrl },
          { label: `${ctx.examType.code} ${ctx.academicYear}` },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel className="px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="pv-eyebrow">{ctx.breadcrumbLabel}</p>
                <h1 className="pv-h2 mt-2">{paper.title}</h1>
                <p className="mt-2 font-mono text-sm">
                  {ctx.examType.name} · {ctx.academicYear}
                  {ctx.sessionLabel ? ` · ${ctx.sessionLabel}` : ""} · {ctx.setLabel}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <VerificationBadge verification={paper.verification} restricted={paper.restricted} />
                {user && isStaff(user.role) ? <StatusChip status={paper.status} /> : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {user ? <BookmarkButton paperId={paper.id} saved={!!bookmark} /> : (
                <Link href={`/login?next=/papers/${paper.id}`} className="pv-btn-secondary">
                  Sign in to save
                </Link>
              )}
              {user ? <ReportDialog paperId={paper.id} /> : null}
              {user && isStaff(user.role) ? (
                <Link href={`/moderation/${paper.id}`} className="pv-btn-secondary">
                  Open in moderation
                </Link>
              ) : null}
            </div>
          </Panel>

          {allowed && file ? (
            <PaperViewer
              fileUrl={`/api/files/${file.id}`}
              downloadUrl={`/api/files/${file.id}?download=1`}
              mimeType={file.mimeType}
              fileName={`${paper.title} — ${ctx.examType.code} ${ctx.academicYear}`}
            />
          ) : (
            <Panel className="bg-pink px-5 py-6">
              <p className="flex items-center gap-2 font-mono text-sm font-bold">
                <ShieldAlert className="h-4 w-4" aria-hidden /> This paper is restricted
              </p>
              <p className="mt-2 max-w-xl text-sm">
                {paper.restrictedReason ??
                  (paper.status === "PUBLISHED"
                    ? "The file is not available to your account."
                    : "This paper has not completed moderator review yet, so the file is not available.")}
              </p>
              <p className="mt-2 font-sans text-[11px] text-ink/70">
                PaperVault holds back current and upcoming exam material by design.
              </p>
            </Panel>
          )}

          <Discussion
            flash={flash}
            paperId={paper.id}
            comments={discussion}
            locked={paper.status !== "PUBLISHED"}
            viewer={
              user
                ? {
                    id: user.id,
                    canModerate: canModerate(user.role),
                    emailVerified: Boolean(user.emailVerifiedAt),
                  }
                : null
            }
          />
        </div>

        <div className="flex flex-col gap-4">
          <Panel className="px-4 py-4">
            <h2 className="pv-section-title">Details</h2>
            <dl className="mt-3 flex flex-col gap-2 font-sans text-sm">
              {[
                ["College", ctx.college.name],
                ["Program", ctx.program.name],
                ["Branch", ctx.branch.name],
                ["Semester", `Semester ${ctx.semesterNumber}`],
                ["Subject", `${ctx.subject.name} (${ctx.subject.code})`],
                ["Exam type", ctx.examType.name],
                ["Academic year", String(ctx.academicYear)],
                ["Paper set", ctx.setLabel],
                ["Uploaded", formatDate(paper.createdAt)],
                ["Contributor", paper.uploadedBy.name],
                ["Downloads", String(paper.downloadCount)],
                ...(file ? [["File", `${file.mimeType.split("/")[1]?.toUpperCase()} · ${formatBytes(file.sizeBytes)}`]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-ink/10 pb-1">
                  <dt className="pv-eyebrow">{label}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/contributors/${paper.uploadedBy.id}`} className="pv-btn-secondary mt-4 w-full">
              View contributor
            </Link>
          </Panel>

          <section>
            <SectionHeader title="Related papers" href={ctx.subjectUrl} hrefLabel="All for this subject" />
            {related.length === 0 ? (
              <EmptyState title="Nothing related yet." />
            ) : (
              <PaperList papers={related} showCollege={false} />
            )}
          </section>

          <Panel className="bg-blue-soft px-4 py-4">
            <h2 className="pv-section-title">Paper timeline</h2>
            <ol className="mt-3 flex flex-col gap-2 font-mono text-[11px]">
              {paper.events.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2">
                  <Chip>{event.toState.replace(/_/g, " ").toLowerCase()}</Chip>
                  <span className="text-ink/60">{formatDate(event.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
