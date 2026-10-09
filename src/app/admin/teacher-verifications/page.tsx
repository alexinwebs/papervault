import Link from "next/link";
import { teacherVerificationEnabled } from "@/lib/features";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, EmptyState, PageHeading, Pagination, Panel } from "@/components/ui";
import { listTeacherVerifications } from "@/server/services/teacher-verification";
import { TEACHER_STATUS_LABEL, TEACHER_VERIFICATION_STATUS, type TeacherVerificationStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Teacher verifications · Admin", robots: { index: false } };

const FILTERS = ["OPEN", ...TEACHER_VERIFICATION_STATUS, "ALL"] as const;

export default async function TeacherVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/teacher-verifications");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const { status = "OPEN", page = "1" } = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(status) ? status : "OPEN";
  const list = await listTeacherVerifications(actor, {
    status: filter === "OPEN" ? undefined : filter,
    page: Number(page) || 1,
  });
  const open = (list.counts.PENDING ?? 0) + (list.counts.UNDER_REVIEW ?? 0) + (list.counts.NEEDS_MORE_INFORMATION ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Teacher verifications"
        description={`${open} open. Oldest first. Documents are private and every view is audited.`}
      />
      {!teacherVerificationEnabled() ? (
        <p className="pv-panel-flat bg-yellow px-4 py-3 font-sans text-sm" data-testid="tv-closed-banner">
          New applications are closed (<code>TEACHER_VERIFICATION_ENABLED=false</code>). You can still review the
          requests below; set it to <code>true</code> and restart to reopen.
        </p>
      ) : null}
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f === "OPEN" ? open : f === "ALL" ? undefined : list.counts[f] ?? 0;
          const label = f === "OPEN" ? "Open" : f === "ALL" ? "All" : TEACHER_STATUS_LABEL[f as TeacherVerificationStatus];
          return (
            <Link
              key={f}
              href={f === "OPEN" ? "?" : `?status=${f}`}
              prefetch={false}
              aria-current={filter === f ? "page" : undefined}
              className={filter === f ? "pv-btn-primary px-3 py-1 text-xs" : "pv-btn-secondary px-3 py-1 text-xs"}
            >
              {label}
              {count !== undefined ? ` · ${count}` : ""}
            </Link>
          );
        })}
      </nav>
      {list.rows.length === 0 ? (
        <EmptyState title="Nothing here" body="No verification requests match this filter." />
      ) : (
        <Panel className="px-4 py-4">
          <ul className="flex flex-col gap-2" data-testid="teacher-verification-list">
            {list.rows.map((row) => (
              <li key={row.id} className="pv-row flex-wrap justify-between gap-2">
                <div className="flex flex-col">
                  <Link href={`/admin/teacher-verifications/${row.id}`} prefetch={false} className="pv-link font-mono text-sm">
                    {row.fullName}
                  </Link>
                  <span className="font-sans text-[11px] text-ink/60">
                    {row.designation}, {row.department} · {row.institutionName} · {row._count.documents} document(s) · {formatDate(row.createdAt)}
                  </span>
                </div>
                <Chip>{TEACHER_STATUS_LABEL[row.status as TeacherVerificationStatus] ?? row.status}</Chip>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Pagination
        page={list.page}
        pages={Math.max(1, Math.ceil(list.total / list.pageSize))}
        total={list.total}
        perPage={list.pageSize}
        params={{ status: filter === "OPEN" ? undefined : filter }}
        label="requests"
      />
    </div>
  );
}
