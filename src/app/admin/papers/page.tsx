import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, EmptyState, PageHeading, Pagination, Panel } from "@/components/ui";
import { adminPaperList } from "@/server/services/admin";
import { PAPER_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { DeleteButton, PaperAdminForm } from "../forms";

export const metadata: Metadata = { title: "Papers · Admin", robots: { index: false } };

export default async function AdminPapersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; done?: string; page?: string }>;
}) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/papers");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const { status = "", q = "", done = "", page = "1" } = await searchParams;
  const papers = await adminPaperList({
    status: status || undefined,
    q: q || undefined,
    page: Number(page),
  });

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Papers"
        description="Publish, restrict, remove or permanently delete any paper on the platform."
      />

      {done ? (
        <p role="status" className="pv-panel-flat bg-mint px-3 py-2 font-mono text-xs">
          {done}
        </p>
      ) : null}

      <Panel className="px-4 py-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor="admin-paper-q" className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em]">
              Search title or subject
            </label>
            <input id="admin-paper-q" name="q" defaultValue={q} className="pv-input" />
          </div>
          <div>
            <label
              htmlFor="admin-paper-status"
              className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em]"
            >
              Status
            </label>
            <select id="admin-paper-status" name="status" defaultValue={status} className="pv-input">
              <option value="">All</option>
              {PAPER_STATUS.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="pv-btn-primary px-4 py-2">
            Filter
          </button>
        </form>
      </Panel>

      {papers.total === 0 ? (
        <EmptyState title="No papers match" body="Try a different status or search term." />
      ) : (
        <ul className="flex flex-col gap-2">
          {papers.rows.map((paper) => {
            const subject = paper.paperSet.examSession.subject;
            const branch = subject.semester.branch;
            const college = branch.program.college;
            return (
              <li key={paper.id} className="pv-panel-flat flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/papers/${paper.id}`} prefetch={false} className="pv-link font-mono text-sm">
                    {paper.title}
                  </Link>
                  <Chip accent={paper.status === "PUBLISHED" ? "mint" : "pink"}>
                    {paper.status.replace(/_/g, " ").toLowerCase()}
                  </Chip>
                </div>
                <p className="font-sans text-[11px] text-ink/60">
                  {college.shortName} · {branch.code} · Sem {subject.semester.number} · {subject.code}{" "}
                  {subject.name} · {paper.paperSet.examSession.examType.name}{" "}
                  {paper.paperSet.examSession.academicYear} · {paper._count.files} file(s) ·{" "}
                  {paper._count.reports} report(s) · by {paper.uploadedBy?.name ?? "unknown"} ·{" "}
                  {formatDate(paper.createdAt)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {paper.status !== "PUBLISHED" ? (
                    <PaperAdminForm paperId={paper.id} action="PUBLISH" label="Publish" />
                  ) : null}
                  {paper.status !== "RESTRICTED" ? (
                    <PaperAdminForm paperId={paper.id} action="RESTRICT" label="Restrict" />
                  ) : null}
                  {paper.status !== "REMOVED" ? (
                    <PaperAdminForm paperId={paper.id} action="REMOVE" label="Remove" />
                  ) : (
                    <PaperAdminForm paperId={paper.id} action="RESTORE" label="Restore" />
                  )}
                  <DeleteButton entity="paper" id={paper.id} label={paper.title} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={papers.page}
        pages={papers.pages}
        total={papers.total}
        perPage={papers.perPage}
        params={{ status, q }}
        label="papers"
      />
    </div>
  );
}
