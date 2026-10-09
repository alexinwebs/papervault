import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chip, PageHeading, Panel, SectionHeader, StatsCard } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { prisma } from "@/lib/db";
import { controlCenterCounts, controlCenterSearch } from "@/server/services/admin";
import { moderationQueue } from "@/server/repositories/papers";
import { openReports } from "@/server/services/moderation";
import { recentAudit } from "@/server/services/audit";
import { formatCount, formatDate } from "@/lib/utils";
import { ControlSearchResults } from "./search-results";

export const metadata: Metadata = { title: "Control center · Admin", robots: { index: false } };

const SECTIONS = [
  {
    href: "/admin/colleges",
    label: "Colleges and degrees",
    body: "Add or delete a campus, edit its details, degrees, branches and exam types.",
  },
  {
    href: "/admin/users",
    label: "Members",
    body: "Create accounts, change roles and tenancy, ban, verify email, clear 2FA.",
  },
  {
    href: "/admin/papers",
    label: "Papers",
    body: "Publish, restrict, remove or restore any paper on the platform.",
  },
  {
    href: "/moderation",
    label: "Moderation",
    body: "Submission queue, reports, takedown notices and the recycle bin.",
  },
  {
    href: "/admin/tickets",
    label: "Support tickets",
    body: "Member tickets with replies, internal notes, status, priority and assignment.",
  },
  {
    href: "/admin/requests",
    label: "College & subject requests",
    body: "Approve to create the college or subject, reject, or ask for more information.",
  },
  {
    href: "/admin/teacher-verifications",
    label: "Teacher verifications",
    body: "Review private documents, approve, reject, request information or revoke.",
  },
  {
    href: "/admin/reports",
    label: "Reports",
    body: "Reports about papers, comments and members. Warn, restrict, suspend or ban from a member's page.",
  },
  {
    href: "/admin/notifications",
    label: "Email outbox",
    body: "Every queued, sent and failed message, with retry state.",
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    body: "Append-only record of every privileged action, searchable.",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    body: "Read-only view of the live configuration: email, storage, scanning, retention.",
  },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const { q = "" } = await searchParams;
  const [counts, [queue, queueTotal], reports, restricted, results, audit, attention] = await Promise.all([
    controlCenterCounts(),
    moderationQueue({ page: 1, pageSize: 5 }),
    openReports(null),
    prisma.paper.count({ where: { restricted: true } }),
    controlCenterSearch(q),
    recentAudit(12),
    Promise.all([
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "WAITING_FOR_ADMIN", "IN_REVIEW"] } } }),
      prisma.collegeRequest.count({ where: { status: "REQUESTED" } }),
      prisma.subjectRequest.count({ where: { status: "REQUESTED" } }),
      prisma.teacherVerificationRequest.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
      prisma.userReport.count({ where: { status: "OPEN" } }),
    ]),
  ]);
  const [ticketsWaiting, collegeRequests, subjectRequests, teacherOpen, userReports] = attention;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Platform admin"
        title="Control center"
        description="Everything on the platform is reachable from here. Search once, then edit or delete in place."
      />

      <Panel className="px-4 py-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label
              htmlFor="control-q"
              className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em]"
            >
              Find anything — college, degree, branch, subject, member or paper
            </label>
            <input
              id="control-q"
              name="q"
              defaultValue={q}
              placeholder="KCS501, Data Structures, RKGIT, priya@…"
              className="pv-input"
            />
          </div>
          <button type="submit" className="pv-btn-primary px-4 py-2 text-xs">
            Search
          </button>
        </form>
        {q && !results ? (
          <p className="mt-3 font-sans text-xs text-ink/60">Type at least two characters.</p>
        ) : null}
      </Panel>

      {results ? <ControlSearchResults results={results} /> : null}

      <section>
        <SectionHeader title="Needs attention" href="/moderation" hrefLabel="Open queue" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="needs-attention">
          <StatsCard value={String(queueTotal)} label="Pending submissions" />
          <StatsCard value={String(reports.length + userReports)} label="Open reports" />
          <StatsCard value={String(ticketsWaiting)} label="Tickets waiting on us" />
          <StatsCard value={String(teacherOpen)} label="Teacher verifications" />
          <StatsCard value={String(collegeRequests + subjectRequests)} label="College & subject requests" />
          <StatsCard value={String(restricted)} label="Restricted papers" />
          <StatsCard value={formatCount(counts.papers)} label="Papers" />
        </div>
        <p className="mt-2 flex flex-wrap gap-3 font-mono text-[11px]">
          <Link href="/admin/tickets" prefetch={false} className="pv-link">Tickets</Link>
          <Link href="/admin/reports" prefetch={false} className="pv-link">Reports</Link>
          <Link href="/admin/teacher-verifications" prefetch={false} className="pv-link">Teacher verifications</Link>
          <Link href="/admin/requests" prefetch={false} className="pv-link">Requests</Link>
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {queue.map((paper) => (
            <li key={paper.id} className="pv-row justify-between">
              <Link
                href={`/moderation/${paper.id}`}
                prefetch={false}
                className="pv-link font-mono text-sm"
              >
                {paper.title}
              </Link>
              <Chip>{paper.status.replace(/_/g, " ").toLowerCase()}</Chip>
            </li>
          ))}
          {queue.length === 0 ? <li className="font-mono text-xs">Queue is clear.</li> : null}
        </ul>
      </section>

      <section>
        <SectionHeader title="Platform inventory" />
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatsCard value={formatCount(counts.colleges)} label="Colleges" />
          <StatsCard value={formatCount(counts.programs)} label="Degrees" />
          <StatsCard value={formatCount(counts.branches)} label="Branches" />
          <StatsCard value={formatCount(counts.semesters)} label="Semesters" />
          <StatsCard value={formatCount(counts.subjects)} label="Subjects" />
          <StatsCard value={formatCount(counts.examTypes)} label="Exam types" />
          <StatsCard value={formatCount(counts.examSessions)} label="Exam sessions" />
          <StatsCard value={formatCount(counts.paperSets)} label="Paper sets" />
          <StatsCard value={formatCount(counts.members)} label="Members" />
        </div>
      </section>

      <section>
        <SectionHeader title="Where to go" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              prefetch={false}
              className="pv-card flex flex-col gap-1 px-4 py-4 no-underline"
            >
              <span className="font-display text-base">{section.label}</span>
              <span className="font-sans text-xs text-ink/70">{section.body}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Audit trail" href="/admin/audit" hrefLabel="Full log" />
        <Panel className="px-4 py-4">
          <ul className="flex flex-col gap-1">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 py-1"
              >
                <span className="font-mono text-xs">{entry.action}</span>
                <span className="font-sans text-[11px] text-ink/60">
                  {entry.actor?.name ?? "system"} · {formatDate(entry.createdAt)}
                </span>
              </li>
            ))}
            {audit.length === 0 ? (
              <li className="font-sans text-xs text-ink/60">Nothing recorded yet.</li>
            ) : null}
          </ul>
        </Panel>
      </section>
    </div>
  );
}
