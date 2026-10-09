import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, PageHeading, Panel } from "@/components/ui";
import { AdminActionForm } from "@/components/AdminActionForm";
import { teacherVerificationDetail } from "@/server/services/teacher-verification";
import { teacherDecisionAction } from "@/server/actions/teacher-verification";
import { ROLE_LABEL, TEACHER_STATUS_LABEL, type TeacherVerificationStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Teacher verification · Admin", robots: { index: false } };

function label(status: string) {
  return TEACHER_STATUS_LABEL[status as TeacherVerificationStatus] ?? status;
}

function kb(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default async function TeacherVerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getSessionUser();
  if (!actor) redirect(`/login?next=/admin/teacher-verifications/${id}`);
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;
  const req = await teacherVerificationDetail(actor, id);
  if (!req) notFound();

  const open = ["PENDING", "UNDER_REVIEW", "NEEDS_MORE_INFORMATION"].includes(req.status);
  const own = req.userId === actor.id;
  const hidden = { requestId: req.id };
  const facts: [string, string | null][] = [
    ["Full name", req.fullName],
    ["Institution", req.institutionName],
    ["Listed college", req.college ? req.college.name : null],
    ["University", req.university],
    ["Department", req.department],
    ["Designation", req.designation],
    ["Subjects taught", req.subjectsTaught],
    ["Institutional email", req.institutionalEmail],
    ["Employee / faculty ID", req.employeeId],
    ["Applicant notes", req.verificationNotes],
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin/teacher-verifications" />
      <PageHeading
        eyebrow={`Teacher verification · TV-${req.id.slice(-8).toUpperCase()}`}
        title={req.fullName}
        description={`Submitted ${formatDate(req.createdAt)}${req.reviewer ? ` · reviewer ${req.reviewer.name}` : ""}`}
        aside={<Chip>{label(req.status)}</Chip>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Panel className="px-4 py-4" testId="tv-applicant">
            <h2 className="pv-section-title mb-3">Applicant</h2>
            <p className="mb-3 font-sans text-xs text-ink/70">
              Account:{" "}
              <Link href={`/admin/users/${req.user.id}`} prefetch={false} className="pv-link">
                {req.user.name}
              </Link>{" "}
              · {req.user.email} · {ROLE_LABEL[req.user.role as keyof typeof ROLE_LABEL] ?? req.user.role} ·{" "}
              {req.user.status.toLowerCase()} · email {req.user.emailVerifiedAt ? "verified" : "unverified"} · joined{" "}
              {formatDate(req.user.createdAt)}
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/60">{k}</dt>
                  <dd className="whitespace-pre-wrap font-sans text-sm">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {req.infoRequested ? (
              <p className="mt-3 pv-panel-flat bg-yellow px-3 py-2 font-sans text-xs">
                Information requested: {req.infoRequested}
              </p>
            ) : null}
            {req.rejectionReason ? (
              <p className="mt-3 font-sans text-xs">Rejection reason: {req.rejectionReason}</p>
            ) : null}
            {req.revokeReason ? <p className="mt-3 font-sans text-xs">Revoke reason: {req.revokeReason}</p> : null}
          </Panel>

          <Panel className="px-4 py-4" testId="tv-documents">
            <h2 className="pv-section-title mb-1">Documents</h2>
            <p className="mb-3 font-sans text-[11px] text-ink/60">
              Private. Opening a document is recorded in the audit log. Links expire after a minute.
            </p>
            <ul className="flex flex-col gap-2">
              {req.documents.map((doc) => (
                <li key={doc.id} className="pv-row flex-wrap justify-between gap-2">
                  {doc.deletedAt ? (
                    <span className="font-mono text-xs text-ink/50">
                      {doc.originalFilename} — deleted {formatDate(doc.deletedAt)}
                    </span>
                  ) : (
                    <a
                      href={`/api/admin/teacher-verifications/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pv-link font-mono text-xs"
                    >
                      {doc.originalFilename}
                    </a>
                  )}
                  <span className="font-sans text-[11px] text-ink/60">
                    {doc.detectedMimeType} · {kb(doc.fileSize)} · scan {doc.scanStatus.toLowerCase()} ·{" "}
                    {doc.retentionStatus.toLowerCase().replace(/_/g, " ")}
                    {doc.deleteAfter && !doc.deletedAt ? ` (deletes ${formatDate(doc.deleteAfter)})` : ""}
                  </span>
                </li>
              ))}
              {req.documents.length === 0 ? <li className="font-sans text-xs text-ink/60">No documents.</li> : null}
            </ul>
          </Panel>

          <Panel className="px-4 py-4" testId="tv-history">
            <h2 className="pv-section-title mb-3">History</h2>
            <ol className="flex flex-col gap-2">
              {req.events.map((e) => (
                <li key={e.id} className="border-b border-ink/10 pb-2">
                  <p className="font-mono text-[11px] text-ink/60">
                    {formatDate(e.createdAt)} · {e.actorName}
                    {e.internal ? " · internal" : ""}
                  </p>
                  <p className="font-sans text-xs">
                    {e.type.replace(/_/g, " ")}
                    {e.fromStatus || e.toStatus ? ` (${e.fromStatus ? label(e.fromStatus) : "—"} → ${e.toStatus ? label(e.toStatus) : "—"})` : ""}
                  </p>
                  {e.note ? <p className="whitespace-pre-wrap font-sans text-xs text-ink/80">{e.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>

          {req.previous.length > 0 ? (
            <Panel className="px-4 py-4">
              <h2 className="pv-section-title mb-3">Previous requests</h2>
              <ul className="flex flex-col gap-1">
                {req.previous.map((p) => (
                  <li key={p.id} className="font-sans text-xs">
                    <Link href={`/admin/teacher-verifications/${p.id}`} prefetch={false} className="pv-link">
                      {formatDate(p.createdAt)}
                    </Link>{" "}
                    · {label(p.status)}
                    {p.rejectionReason ? ` — ${p.rejectionReason}` : ""}
                    {p.revokeReason ? ` — ${p.revokeReason}` : ""}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          {own ? (
            <Panel className="px-4 py-4">
              <p className="font-sans text-xs">This is your own request. Another admin must review it.</p>
            </Panel>
          ) : null}
          {open && !own ? (
            <>
              {req.status === "PENDING" ? (
                <Panel className="px-4 py-4">
                  <AdminActionForm action={teacherDecisionAction} hidden={{ ...hidden, decision: "START_REVIEW" }} submitLabel="Start review" testId="tv-start" />
                </Panel>
              ) : null}
              <Panel className="px-4 py-4">
                <h2 className="pv-section-title mb-2">Approve</h2>
                <p className="mb-2 font-sans text-[11px] text-ink/70">
                  Grants the Verified Teacher badge and role. Check the documents first.
                </p>
                <AdminActionForm
                  action={teacherDecisionAction}
                  hidden={{ ...hidden, decision: "APPROVE" }}
                  fields={[{ name: "note", label: "Note to applicant (optional)", type: "textarea", maxLength: 1000 }]}
                  typedConfirm="APPROVE"
                  confirm="Approve this teacher and grant the Verified Teacher role?"
                  submitLabel="Approve teacher"
                  variant="primary"
                  testId="tv-approve"
                />
              </Panel>
              <Panel className="px-4 py-4">
                <h2 className="pv-section-title mb-2">Ask for more information</h2>
                <AdminActionForm
                  action={teacherDecisionAction}
                  hidden={{ ...hidden, decision: "REQUEST_INFO" }}
                  fields={[{ name: "message", label: "What should they send?", type: "textarea", required: true, maxLength: 1000 }]}
                  submitLabel="Request information"
                  testId="tv-info"
                />
              </Panel>
              <Panel className="px-4 py-4">
                <h2 className="pv-section-title mb-2">Reject</h2>
                <AdminActionForm
                  action={teacherDecisionAction}
                  hidden={{ ...hidden, decision: "REJECT" }}
                  fields={[
                    { name: "reason", label: "Reason (sent to applicant)", type: "textarea", required: true, maxLength: 1000 },
                    { name: "internalNote", label: "Internal note (admins only)", type: "textarea", maxLength: 1000 },
                  ]}
                  confirm="Reject this verification request?"
                  submitLabel="Reject"
                  testId="tv-reject"
                />
              </Panel>
            </>
          ) : null}
          {req.status === "APPROVED" && !own ? (
            <Panel className="px-4 py-4">
              <h2 className="pv-section-title mb-2">Revoke verification</h2>
              <AdminActionForm
                action={teacherDecisionAction}
                hidden={{ ...hidden, decision: "REVOKE" }}
                fields={[{ name: "reason", label: "Reason", type: "textarea", required: true, maxLength: 1000 }]}
                typedConfirm="REVOKE"
                confirm="Remove the Verified Teacher role from this account?"
                submitLabel="Revoke"
                testId="tv-revoke"
              />
            </Panel>
          ) : null}
          <Panel className="px-4 py-4">
            <h2 className="pv-section-title mb-2">Internal note</h2>
            <AdminActionForm
              action={teacherDecisionAction}
              hidden={{ ...hidden, decision: "NOTE" }}
              fields={[{ name: "note", label: "Visible to admins only", type: "textarea", required: true, maxLength: 2000 }]}
              submitLabel="Add note"
              testId="tv-note"
            />
          </Panel>
          {!open && req.documents.some((d) => !d.deletedAt) ? (
            <Panel className="px-4 py-4">
              <h2 className="pv-section-title mb-2">Documents</h2>
              <AdminActionForm
                action={teacherDecisionAction}
                hidden={{ ...hidden, decision: "DELETE_DOCUMENTS" }}
                confirm="Permanently delete the stored documents now?"
                submitLabel="Delete documents now"
                testId="tv-delete-docs"
              />
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
