import Link from "next/link";
import type { Metadata } from "next";
import { Chip, EmptyState, PageHeading, Panel, SectionHeader, StatsCard } from "@/components/ui";
import { StatusChip } from "@/components/VerificationBadge";
import { ResolveReportForm } from "@/components/ModerationActions";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canModerate } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { moderationQueue } from "@/server/repositories/papers";
import { openReports } from "@/server/services/moderation";
import { prisma, prismaRaw } from "@/lib/db";
import { PAPER_STATUS } from "@/lib/constants";
import { paperContext } from "@/lib/links";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/moderation");
  if (!canModerate(user.role)) return <Forbidden area="Moderation" />;
  const { status, q, page } = await searchParams;
  const scope = user.role === "PLATFORM_ADMIN" ? null : user.collegeId;

  const [[papers, total], reports] = await Promise.all([
    moderationQueue({
      collegeId: scope,
      status: status && PAPER_STATUS.includes(status as (typeof PAPER_STATUS)[number]) ? status : undefined,
      q,
      page: Number(page ?? 1),
    }),
    openReports(scope),
  ]);
  const [takedowns, binned] = await Promise.all([
    prisma.takedownRequest.count({ where: { status: "OPEN" } }),
    prismaRaw.paper.count({
      where: {
        deletedAt: { not: null },
        ...(scope
          ? {
              paperSet: {
                examSession: { subject: { semester: { branch: { program: { collegeId: scope } } } } },
              },
            }
          : {}),
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow={user.role === "PLATFORM_ADMIN" ? "Platform moderation" : "College moderation"}
        title="Review queue"
        description={
          scope
            ? "You can only act on submissions from your own college."
            : "Platform admins see submissions from every college."
        }
        aside={
          <div className="flex flex-wrap gap-2">
            <Link href="/moderation/takedowns" prefetch={false} className="pv-btn-secondary px-3 py-2">
              Takedown notices{takedowns > 0 ? ` (${takedowns})` : ""}
            </Link>
            <Link href="/moderation/recycle-bin" prefetch={false} className="pv-btn-secondary px-3 py-2">
              Recycle bin{binned > 0 ? ` (${binned})` : ""}
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatsCard value={String(total)} label="In queue" />
        <StatsCard value={String(reports.length)} label="Open reports" />
        <StatsCard value={String(papers.filter((p) => p.restricted).length)} label="Restricted here" />
      </div>

      <Panel className="px-4 py-4">
        <form className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div>
            <label className="pv-label" htmlFor="q">
              Search title
            </label>
            <input id="q" name="q" className="pv-input" defaultValue={q ?? ""} />
          </div>
          <div>
            <label className="pv-label" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" className="pv-input" defaultValue={status ?? ""}>
              <option value="">Needs attention</option>
              {PAPER_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="pv-btn-primary">
            Filter
          </button>
        </form>
      </Panel>

      <section>
        <SectionHeader title="Submissions" />
        {papers.length === 0 ? (
          <EmptyState title="Queue is clear." body="New submissions will appear here." />
        ) : (
          <div className="pv-table-wrap">
            <table className="pv-table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Context</th>
                  <th>Status</th>
                  <th>Reports</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => {
                  const ctx = paperContext(paper);
                  return (
                    <tr key={paper.id}>
                      <td className="font-mono text-sm font-bold">{paper.title}</td>
                      <td className="text-[11px] text-ink/70">
                        {ctx.college.shortName} · {ctx.branch.code} · Sem {ctx.semesterNumber} ·{" "}
                        {ctx.examType.code} {ctx.academicYear}
                      </td>
                      <td>
                        <StatusChip status={paper.status} />
                      </td>
                      <td className="font-mono text-xs">{paper.reports.length}</td>
                      <td className="font-sans text-[11px]">{formatDate(paper.createdAt)}</td>
                      <td>
                        <Link href={`/moderation/${paper.id}`} prefetch={false} className="pv-btn-secondary">
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionHeader title={`Open reports (${reports.length})`} />
        {reports.length === 0 ? (
          <EmptyState title="No open reports." />
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report) => (
              <li key={report.id} className="pv-panel-flat bg-paper px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/moderation/${report.paper.id}`}
                    prefetch={false}
                    className="pv-link font-mono text-sm font-bold"
                  >
                    {report.paper.title}
                  </Link>
                  <Chip accent="pink">{report.reason.replace(/_/g, " ").toLowerCase()}</Chip>
                </div>
                {report.details ? <p className="mt-2 text-sm">{report.details}</p> : null}
                <p className="mt-1 font-sans text-[11px] text-ink/60">
                  by {report.reportedBy.name} · {formatDate(report.createdAt)}
                </p>
                <div className="mt-3">
                  <ResolveReportForm reportId={report.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
