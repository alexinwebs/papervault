import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, EmptyState, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { AdminActionForm } from "@/components/AdminActionForm";
import { ResolveReportForm } from "@/components/ModerationActions";
import { prisma } from "@/lib/db";
import { openUserReports } from "@/server/services/user-reports";
import { resolveUserReportAction } from "@/server/actions/support";
import { USER_REPORT_REASON_LABEL, USER_STATUS_LABEL, type UserReportReason } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports · Admin", robots: { index: false } };

const TABS = [
  { key: "papers", label: "Papers" },
  { key: "comments", label: "Comments" },
  { key: "users", label: "Users" },
] as const;

function reason(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/reports");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "papers";

  const [paperReports, commentReports, userReports] = await Promise.all([
    prisma.report.findMany({
      where: { status: "OPEN", commentId: null },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { paper: { select: { id: true, title: true, status: true, restricted: true } }, reportedBy: { select: { name: true } } },
    }),
    prisma.report.findMany({
      where: { status: "OPEN", commentId: { not: null } },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        paper: { select: { id: true, title: true } },
        comment: { select: { id: true, body: true, status: true, author: { select: { id: true, name: true } } } },
        reportedBy: { select: { name: true } },
      },
    }),
    openUserReports(actor),
  ]);
  const counts = { papers: paperReports.length, comments: commentReports.length, users: userReports.length };

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Reports"
        description="Open reports about papers, comments and members, oldest first. Current-exam reports restrict the paper automatically until reviewed."
      />
      <nav aria-label="Report type" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            prefetch={false}
            aria-current={tab === t.key ? "page" : undefined}
            className={tab === t.key ? "pv-btn-primary px-3 py-1 text-xs" : "pv-btn-secondary px-3 py-1 text-xs"}
          >
            {t.label} · {counts[t.key]}
          </Link>
        ))}
      </nav>

      {tab === "papers" ? (
        <section>
          <SectionHeader title="Paper reports" />
          {paperReports.length === 0 ? (
            <EmptyState title="No open paper reports." />
          ) : (
            <ul className="flex flex-col gap-3">
              {paperReports.map((r) => (
                <li key={r.id} className="pv-panel-flat bg-paper px-3 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/moderation/${r.paper.id}`} prefetch={false} className="pv-link font-mono text-sm">
                      {r.paper.title}
                    </Link>
                    <span className="flex gap-1">
                      <Chip accent="pink">{reason(r.reason)}</Chip>
                      <Chip>{r.paper.restricted ? "restricted" : r.paper.status.toLowerCase()}</Chip>
                    </span>
                  </div>
                  {r.details ? <p className="mt-2 text-sm">{r.details}</p> : null}
                  <p className="mt-1 font-sans text-[11px] text-ink/60">
                    by {r.reportedBy.name} · {formatDate(r.createdAt)}
                  </p>
                  <div className="mt-2">
                    <ResolveReportForm reportId={r.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "comments" ? (
        <section>
          <SectionHeader title="Comment reports" />
          {commentReports.length === 0 ? (
            <EmptyState title="No open comment reports." />
          ) : (
            <ul className="flex flex-col gap-3">
              {commentReports.map((r) => (
                <li key={r.id} className="pv-panel-flat bg-paper px-3 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/papers/${r.paper.id}`} prefetch={false} className="pv-link font-mono text-sm">
                      On “{r.paper.title}”
                    </Link>
                    <Chip accent="pink">{reason(r.reason)}</Chip>
                  </div>
                  {r.comment ? (
                    <blockquote className="mt-2 border-l-2 border-ink/20 pl-2 font-sans text-sm">
                      {r.comment.status === "REMOVED" ? <em>(removed)</em> : r.comment.body}
                      <span className="block font-sans text-[11px] text-ink/60">
                        —{" "}
                        <Link href={`/admin/users/${r.comment.author.id}`} prefetch={false} className="pv-link">
                          {r.comment.author.name}
                        </Link>
                      </span>
                    </blockquote>
                  ) : null}
                  {r.details ? <p className="mt-2 text-sm">{r.details}</p> : null}
                  <p className="mt-1 font-sans text-[11px] text-ink/60">
                    by {r.reportedBy.name} · {formatDate(r.createdAt)} · remove the comment from the paper page if needed
                  </p>
                  <div className="mt-2">
                    <ResolveReportForm reportId={r.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "users" ? (
        <section>
          <SectionHeader title="Member reports" />
          {userReports.length === 0 ? (
            <EmptyState title="No open member reports." />
          ) : (
            <ul className="flex flex-col gap-3" data-testid="user-reports">
              {userReports.map((r) => (
                <li key={r.id} className="pv-panel-flat bg-paper px-3 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/admin/users/${r.reportedUser.id}`} prefetch={false} className="pv-link font-mono text-sm">
                      {r.reportedUser.name}
                    </Link>
                    <span className="flex gap-1">
                      <Chip accent="pink">
                        {USER_REPORT_REASON_LABEL[r.reason as UserReportReason] ?? reason(r.reason)}
                      </Chip>
                      <Chip>
                        {USER_STATUS_LABEL[r.reportedUser.status as keyof typeof USER_STATUS_LABEL]?.toLowerCase() ?? r.reportedUser.status}
                      </Chip>
                    </span>
                  </div>
                  {r.details ? <p className="mt-2 text-sm">{r.details}</p> : null}
                  <p className="mt-1 font-sans text-[11px] text-ink/60">
                    by {r.reportedBy.name} · {formatDate(r.createdAt)} · warn, restrict, suspend or ban from the member page
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <AdminActionForm
                      action={resolveUserReportAction}
                      hidden={{ reportId: r.id, status: "RESOLVED" }}
                      fields={[{ name: "resolution", label: "Resolution note", maxLength: 500 }]}
                      submitLabel="Resolve"
                      variant="primary"
                    />
                    <AdminActionForm
                      action={resolveUserReportAction}
                      hidden={{ reportId: r.id, status: "DISMISSED" }}
                      fields={[{ name: "resolution", label: "Why dismiss?", maxLength: 500 }]}
                      submitLabel="Dismiss"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
