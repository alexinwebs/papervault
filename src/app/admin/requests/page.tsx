import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, EmptyState, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { AdminActionForm } from "@/components/AdminActionForm";
import { openCatalogueRequests, semesterOptions } from "@/server/services/catalogue-requests";
import { collegeRequestDecisionAction, subjectRequestDecisionAction } from "@/server/actions/support";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Requests · Admin", robots: { index: false } };

function shortNameGuess(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !["of", "and", "the", "&"].includes(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 12);
}

export default async function AdminRequestsPage() {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/requests");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;
  const { colleges, subjects } = await openCatalogueRequests(actor);
  const semesterLists = new Map(
    await Promise.all(
      [...new Set(subjects.map((s) => s.collegeId))].map(async (id) => [id, await semesterOptions(id)] as const),
    ),
  );
  const decision = [
    { value: "APPROVE", label: "Approve and create" },
    { value: "NEEDS_INFORMATION", label: "Ask for more information" },
    { value: "REJECT", label: "Reject" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="College & subject requests"
        description="Approving creates the college or subject with the normal admin tools and tells the member on their ticket. Reject or ask for more information needs a note."
      />

      <section>
        <SectionHeader title={`College requests (${colleges.length})`} />
        {colleges.length === 0 ? (
          <EmptyState title="No open college requests." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2" data-testid="college-requests">
            {colleges.map((r) => (
              <Panel key={r.id} className="px-4 py-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm">{r.name}</span>
                  <Chip>{r.status.replace(/_/g, " ").toLowerCase()}</Chip>
                </div>
                <p className="mb-2 font-sans text-xs text-ink/70">
                  {r.university} · {r.city}, {r.state}
                  {r.website ? (
                    <>
                      {" · "}
                      <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="pv-link">website</a>
                    </>
                  ) : null}
                  <br />
                  <Link href={`/admin/tickets/${r.ticket.id}`} prefetch={false} className="pv-link">{r.ticket.number}</Link> by{" "}
                  {r.ticket.requester.name} · {formatDate(r.createdAt)}
                </p>
                {r.details ? <p className="mb-3 whitespace-pre-wrap font-sans text-xs">{r.details}</p> : null}
                <AdminActionForm
                  action={collegeRequestDecisionAction}
                  hidden={{ requestId: r.id }}
                  fields={[
                    { name: "decision", label: "Decision", type: "select", options: decision, defaultValue: "APPROVE" },
                    { name: "name", label: "College name", defaultValue: r.name, maxLength: 160 },
                    { name: "shortName", label: "Short name (needed to approve)", defaultValue: shortNameGuess(r.name), maxLength: 24 },
                    { name: "university", label: "University", defaultValue: r.university, maxLength: 160 },
                    { name: "city", label: "City", defaultValue: r.city, maxLength: 60 },
                    { name: "state", label: "State", defaultValue: r.state, maxLength: 60 },
                    { name: "note", label: "Note to member (required to reject / ask)", type: "textarea", maxLength: 1000 },
                  ]}
                  confirm="Save this decision? Approving creates the college immediately."
                  submitLabel="Save decision"
                  variant="primary"
                  testId={`college-request-${r.id}`}
                />
              </Panel>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title={`Subject requests (${subjects.length})`} />
        {subjects.length === 0 ? (
          <EmptyState title="No open subject requests." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2" data-testid="subject-requests">
            {subjects.map((r) => {
              const sems = semesterLists.get(r.collegeId) ?? [];
              return (
                <Panel key={r.id} className="px-4 py-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-sm">
                      {r.subjectName}
                      {r.subjectCode ? ` (${r.subjectCode})` : ""}
                    </span>
                    <Chip>{r.status.replace(/_/g, " ").toLowerCase()}</Chip>
                  </div>
                  <p className="mb-2 font-sans text-xs text-ink/70">
                    {r.college.name}
                    <br />
                    <Link href={`/admin/tickets/${r.ticket.id}`} prefetch={false} className="pv-link">{r.ticket.number}</Link> by{" "}
                    {r.ticket.requester.name} · {formatDate(r.createdAt)}
                  </p>
                  {r.details ? <p className="mb-3 whitespace-pre-wrap font-sans text-xs">{r.details}</p> : null}
                  {sems.length === 0 ? (
                    <p className="mb-2 font-sans text-[11px] text-red-700">
                      This college has no semesters yet. Add its degree and branch in{" "}
                      <Link href={`/admin/colleges`} prefetch={false} className="pv-link">Colleges</Link> first, or ask the member for details.
                    </p>
                  ) : null}
                  <AdminActionForm
                    action={subjectRequestDecisionAction}
                    hidden={{ requestId: r.id }}
                    fields={[
                      { name: "decision", label: "Decision", type: "select", options: decision, defaultValue: sems.length ? "APPROVE" : "NEEDS_INFORMATION" },
                      {
                        name: "semesterId",
                        label: "Semester",
                        type: "select",
                        defaultValue: r.semesterId ?? "",
                        options: [
                          { value: "", label: "Choose…" },
                          ...sems.map((s) => ({ value: s.id, label: `${s.branch.program.name} · ${s.branch.name} · Sem ${s.number}` })),
                        ],
                      },
                      { name: "name", label: "Subject name", defaultValue: r.subjectName, maxLength: 140 },
                      { name: "code", label: "Subject code (needed to approve)", defaultValue: r.subjectCode ?? "", maxLength: 20 },
                      { name: "note", label: "Note to member (required to reject / ask)", type: "textarea", maxLength: 1000 },
                    ]}
                    confirm="Save this decision? Approving creates the subject immediately."
                    submitLabel="Save decision"
                    variant="primary"
                    testId={`subject-request-${r.id}`}
                  />
                </Panel>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
