import Link from "next/link";
import type { Metadata } from "next";
import { BackBar, Chip, PageHeading, Panel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OPEN_TEACHER_STATUSES,
  TEACHER_DOC_MAX_BYTES,
  TEACHER_DOC_MAX_FILES,
  TEACHER_STATUS_LABEL,
  type TeacherVerificationStatus,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { teacherVerificationEnabled } from "@/lib/features";
import {
  documentRetentionDays,
  myTeacherVerification,
  reapplyCooldownDays,
} from "@/server/services/teacher-verification";
import { MoreInformationForm, TeacherApplicationForm, WithdrawForm } from "./forms";

export const metadata: Metadata = { title: "Teacher verification", robots: { index: false } };

const STATUS_ACCENT: Record<TeacherVerificationStatus, "yellow" | "blue" | "pink" | "mint" | "cream" | "lavender"> = {
  PENDING: "yellow",
  UNDER_REVIEW: "blue",
  NEEDS_MORE_INFORMATION: "pink",
  APPROVED: "mint",
  REJECTED: "pink",
  CANCELLED: "cream",
  REVOKED: "lavender",
};

const STATUS_MESSAGE: Record<TeacherVerificationStatus, string> = {
  PENDING: "Verification submitted. It's waiting for an admin to pick it up.",
  UNDER_REVIEW: "Your application is under review.",
  NEEDS_MORE_INFORMATION: "Additional information is required before we can decide.",
  APPROVED: "Your teacher verification has been approved.",
  REJECTED: "Your verification request was rejected.",
  CANCELLED: "You withdrew this request.",
  REVOKED: "Your teacher verification was revoked.",
};

export default async function TeacherVerificationPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <BackBar fallback="/settings" />
        <PageHeading eyebrow="Account" title="Become a Verified Teacher" description="Sign in to apply for teacher verification." />
        <Link href="/login?next=/teacher-verification" className="pv-btn-primary self-start">
          Sign in
        </Link>
      </div>
    );
  }

  const [{ current, history }, colleges, profile] = await Promise.all([
    myTeacherVerification(user.id),
    prisma.college.findMany({
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      select: { id: true, name: true, university: true },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { collegeId: true } }),
  ]);

  const status = current?.status as TeacherVerificationStatus | undefined;
  const open = status ? OPEN_TEACHER_STATUSES.includes(status) : false;
  const cooldownUntil =
    status === "REJECTED" && current?.reviewedAt && reapplyCooldownDays() > 0
      ? new Date(current.reviewedAt.getTime() + reapplyCooldownDays() * 86_400_000)
      : null;
  const inCooldown = cooldownUntil ? cooldownUntil > new Date() : false;
  const enabled = teacherVerificationEnabled();
  const canApply = enabled && user.role === "STUDENT" && !open && !inCooldown;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <BackBar fallback="/settings" />
      <PageHeading
        eyebrow="Account"
        title="Become a Verified Teacher"
        description="Faculty members can ask us to verify their teaching affiliation. Verified teachers get a Verified Teacher badge on their profile and comments."
      />

      {user.role === "TEACHER" ? (
        <Panel className="bg-mint px-4 py-4" testId="teacher-approved">
          <p className="font-mono text-sm font-bold">You&apos;re a Verified Teacher.</p>
          <p className="mt-1 font-sans text-sm text-ink/80">
            The badge means PaperVault has checked your teaching affiliation. It doesn&apos;t vouch for anything else,
            and your documents, employee ID and admin notes are never shown publicly.
          </p>
        </Panel>
      ) : null}

      {!enabled && user.role !== "TEACHER" ? (
        <Panel className="bg-yellow px-4 py-4" testId="teacher-closed">
          <p className="font-mono text-sm font-bold">Teacher verification isn&apos;t open yet.</p>
          <p className="mt-1 font-sans text-sm text-ink/80">
            We&apos;re not accepting new applications right now. Please check back later
            {open ? " — your existing request is kept and will still be reviewed" : ""}.
          </p>
        </Panel>
      ) : null}

      {user.role !== "STUDENT" && user.role !== "TEACHER" ? (
        <Panel className="px-4 py-4">
          <p className="font-sans text-sm">Staff accounts don&apos;t need teacher verification.</p>
        </Panel>
      ) : null}

      {current && status ? (
        <Panel className="flex flex-col gap-3 px-4 py-4" testId="teacher-status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="pv-eyebrow">Your request · submitted {formatDate(current.createdAt)}</p>
            <Chip accent={STATUS_ACCENT[status]}>{TEACHER_STATUS_LABEL[status]}</Chip>
          </div>
          <p className="font-mono text-sm font-bold">{STATUS_MESSAGE[status]}</p>
          <dl className="grid gap-1 font-sans text-xs text-ink/80 sm:grid-cols-2">
            <div><dt className="inline text-ink/60">Institution: </dt><dd className="inline">{current.institutionName}</dd></div>
            <div><dt className="inline text-ink/60">Role: </dt><dd className="inline">{current.designation}, {current.department}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-ink/60">Documents: </dt><dd className="inline">{current.documents.length > 0 ? current.documents.map((d) => d.originalFilename).join(", ") : "Deleted after the decision (retention policy)"}</dd></div>
          </dl>

          {status === "NEEDS_MORE_INFORMATION" ? (
            <div className="flex flex-col gap-3 border-t-2 border-ink/10 pt-3">
              <div className="pv-panel-flat bg-yellow px-3 py-2">
                <p className="pv-eyebrow">What the reviewer needs</p>
                <p className="mt-1 whitespace-pre-line font-sans text-sm">{current.infoRequested}</p>
              </div>
              <MoreInformationForm requestId={current.id} maxFiles={TEACHER_DOC_MAX_FILES} maxBytes={TEACHER_DOC_MAX_BYTES} />
            </div>
          ) : null}
          {status === "REJECTED" && current.rejectionReason ? (
            <p className="pv-panel-flat bg-pink px-3 py-2 font-sans text-sm">Reason: {current.rejectionReason}</p>
          ) : null}
          {status === "REVOKED" && current.revokeReason ? (
            <p className="pv-panel-flat bg-pink px-3 py-2 font-sans text-sm">Reason: {current.revokeReason}</p>
          ) : null}
          {inCooldown && cooldownUntil ? (
            <p className="font-sans text-xs text-ink/70">You can apply again from {formatDate(cooldownUntil)}.</p>
          ) : null}
          {open ? <WithdrawForm requestId={current.id} /> : null}

          <ol className="flex flex-col gap-1 border-t-2 border-ink/10 pt-3" aria-label="Request history">
            {current.events.map((event) => (
              <li key={event.id} className="flex justify-between gap-2 font-mono text-[11px] text-ink/70">
                <span>
                  {event.type === "submitted"
                    ? "Submitted"
                    : event.type === "info_provided"
                      ? "You sent more information"
                      : event.type === "document_deleted"
                        ? "A document was deleted (retention)"
                        : event.toStatus
                          ? TEACHER_STATUS_LABEL[event.toStatus as TeacherVerificationStatus]
                          : event.type}
                </span>
                <span>{formatDate(event.createdAt)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}

      {canApply ? (
        <Panel className="px-4 py-4">
          <h2 className="pv-section-title mb-3">{current ? "Apply again" : "Apply for verification"}</h2>
          <TeacherApplicationForm
            colleges={colleges}
            defaults={{ fullName: user.name, collegeId: profile.collegeId ?? "" }}
            maxFiles={TEACHER_DOC_MAX_FILES}
            maxBytes={TEACHER_DOC_MAX_BYTES}
          />
        </Panel>
      ) : null}

      <Panel className="bg-blue-light px-4 py-4">
        <h2 className="pv-section-title">How verification works</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 font-sans text-sm text-ink/80">
          <li>Every request is reviewed by a person. Submitting documents doesn&apos;t guarantee approval.</li>
          <li>Only current teachers and faculty members should apply.</li>
          <li>False or borrowed documents lead to rejection and can lead to action on your account.</li>
          <li>
            We only need proof of your teaching affiliation. Don&apos;t send Aadhaar, PAN, bank details, your home address
            or date of birth.
          </li>
          <li>
            Documents are private: only PaperVault admins can open them, every access is logged, and they&apos;re deleted{" "}
            {documentRetentionDays()} days after the decision.
          </li>
        </ul>
        <p className="mt-2 font-sans text-xs">
          Read the full <Link href="/legal/teacher-verification" className="pv-link">Teacher Verification Policy</Link>.
        </p>
      </Panel>

      {history.length > 0 ? (
        <Panel className="px-4 py-4">
          <h2 className="pv-section-title">Earlier requests</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {history.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 font-mono text-[11px]">
                <span>{formatDate(item.createdAt)}</span>
                <span>{TEACHER_STATUS_LABEL[item.status as TeacherVerificationStatus]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
