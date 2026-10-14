import { SuccessPopup } from "@/components/SuccessPopup";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { Breadcrumbs, Chip, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { adminCollegeList, adminMemberDetail } from "@/server/services/admin";
import { formatDate } from "@/lib/utils";
import { AdminForm, DeleteButton } from "../../forms";
import { memberActionAction, updateMemberAction } from "@/server/actions/admin";
import { AdminActionForm } from "@/components/AdminActionForm";
import { ROLE_LABEL, USER_STATUS_LABEL } from "@/lib/constants";
import { MemberActionButton } from "../member-actions";

export const metadata: Metadata = { title: "Member · Admin", robots: { index: false } };

export default async function AdminMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { userId } = await params;
  const actor = await getSessionUser();
  if (!actor) redirect(`/login?next=/admin/users/${userId}`);
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const [member, colleges, { done }] = await Promise.all([
    adminMemberDetail(userId),
    adminCollegeList(),
    searchParams,
  ]);
  if (!member) notFound();

  const isSelf = member.id === actor.id;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Control center", href: "/admin" },
          { label: "Members", href: "/admin/users" },
          { label: member.name },
        ]}
      />
      <PageHeading
        eyebrow="Member"
        title={member.name}
        description={`${member.email} · joined ${formatDate(member.createdAt)}`}
      />

      {done ? (
        <SuccessPopup message={`${done}`} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Chip>{ROLE_LABEL[member.role as keyof typeof ROLE_LABEL]?.toLowerCase() ?? member.role.toLowerCase()}</Chip>
        <Chip accent={member.status === "ACTIVE" ? "mint" : "pink"}>
          {USER_STATUS_LABEL[member.status as keyof typeof USER_STATUS_LABEL]?.toLowerCase() ?? member.status.toLowerCase()}
        </Chip>
        <Chip accent="mint">{member.trustLevel.replace(/_/g, " ").toLowerCase()}</Chip>
        <Chip accent={member.emailVerifiedAt ? "mint" : "yellow"}>
          {member.emailVerifiedAt ? "email confirmed" : "email unconfirmed"}
        </Chip>
        <Chip accent={member.totpConfirmedAt ? "mint" : "cream"}>
          {member.totpConfirmedAt ? "2FA on" : "2FA off"}
        </Chip>
        <Chip accent="lavender">{member._count.papers} uploads</Chip>
        <Chip accent="lavender">{member._count.comments} comments</Chip>
        <Chip accent="lavender">{member._count.sessions} active sessions</Chip>
      </div>

      {member.status !== "ACTIVE" ? (
        <Panel className="bg-pink px-4 py-3" testId="member-standing">
          <p className="font-mono text-xs">
            {USER_STATUS_LABEL[member.status as keyof typeof USER_STATUS_LABEL] ?? member.status}
            {member.status === "BANNED" && member.bannedAt ? ` ${formatDate(member.bannedAt)}` : ""}
            {member.statusUntil ? ` until ${formatDate(member.statusUntil)}` : ""} —{" "}
            {member.statusReason ?? member.banReason ?? "no reason recorded"}
          </p>
        </Panel>
      ) : null}

      <section>
        <SectionHeader title="Account details" href={`/contributors/${member.id}`} hrefLabel="Public profile" />
        <Panel className="px-4 py-4">
          <AdminForm
            idPrefix="edit-member"
            action={updateMemberAction}
            submitLabel="Save member"
            resetOnSuccess={false}
            hidden={{ userId: member.id }}
            fields={[
              { name: "name", label: "Name", required: true, defaultValue: member.name },
              { name: "email", label: "Email", required: true, defaultValue: member.email },
              {
                name: "role",
                label: "Role",
                type: "select",
                defaultValue: member.role,
                hint:
                  member.role === "TEACHER"
                    ? "Verified teacher since " + (member.teacherVerifiedAt ? formatDate(member.teacherVerifiedAt) : "approval") + ". Revoke from Teacher verifications to change."
                    : "Verified teacher is granted only by approving a teacher verification request.",
                options: [
                  ...(member.role === "TEACHER" ? [{ value: "TEACHER", label: "Verified teacher" }] : []),
                  { value: "STUDENT", label: "Student" },
                  { value: "MODERATOR", label: "Moderator" },
                  { value: "COLLEGE_ADMIN", label: "College admin" },
                  { value: "PLATFORM_ADMIN", label: "Platform admin" },
                ],
              },
              {
                name: "collegeId",
                label: "College",
                type: "select",
                defaultValue: member.collegeId ?? "",
                hint: "Moderators and college admins act only inside this college.",
                options: [
                  { value: "", label: "No college" },
                  ...colleges.map((college) => ({ value: college.id, label: college.shortName })),
                ],
              },
              {
                name: "trustLevel",
                label: "Trust level",
                type: "select",
                defaultValue: member.trustLevel,
                options: [
                  { value: "NEW", label: "New" },
                  { value: "VERIFIED_CONTRIBUTOR", label: "Verified contributor" },
                  { value: "TRUSTED_CONTRIBUTOR", label: "Trusted contributor" },
                ],
              },
            ]}
          />
          <p className="mt-3 font-sans text-[11px] text-ink/60">
            Changing the email address clears the confirmation, so the member has to prove the new
            mailbox before uploading again.
          </p>
        </Panel>
      </section>

      <section>
        <SectionHeader title="Account standing" />
        <Panel className="px-4 py-4">
          <p className="mb-3 font-sans text-xs text-ink/70">
            Warned: can still post, sees the warning. Restricted: read-only (no uploads, comments or
            tickets). Suspended: cannot sign in until the date, or until lifted. Banned: cannot sign in.
            The member is notified and every change is audited with its reason.
          </p>
          {isSelf ? (
            <p className="font-sans text-xs text-ink/60">You can&apos;t change your own standing.</p>
          ) : (
            <AdminActionForm
              action={memberActionAction}
              hidden={{ userId: member.id }}
              fields={[
                {
                  name: "action",
                  label: "Set standing",
                  type: "select",
                  defaultValue: "WARN",
                  options: [
                    { value: "WARN", label: "Warn" },
                    { value: "RESTRICT", label: "Restrict (read-only)" },
                    { value: "SUSPEND", label: "Suspend" },
                    { value: "BAN", label: "Ban" },
                    { value: "UNBAN", label: "Restore to active" },
                  ],
                },
                { name: "days", label: "Suspension length in days (blank = until lifted)", type: "number" },
                { name: "reason", label: "Reason (shown to the member and in the audit log)", type: "textarea", maxLength: 500 },
              ]}
              confirm={`Change the standing of ${member.name}?`}
              submitLabel="Apply"
              testId="member-standing-form"
            />
          )}
        </Panel>
      </section>

      <section>
        <SectionHeader title="Account actions" />
        <Panel className="flex flex-wrap gap-2 px-4 py-4">
          <MemberActionButton
            userId={member.id}
            action="REVOKE_SESSIONS"
            label="Sign out everywhere"
            confirm={`Sign ${member.name} out of every device?`}
          />
          {member.emailVerifiedAt ? null : (
            <MemberActionButton userId={member.id} action="VERIFY_EMAIL" label="Mark email confirmed" />
          )}
          {member.totpConfirmedAt ? (
            <MemberActionButton
              userId={member.id}
              action="RESET_2FA"
              label="Clear two-step verification"
              confirm={`Clear 2FA for ${member.name}? They will have to enrol again.`}
            />
          ) : null}
        </Panel>
      </section>

      <section>
        <SectionHeader title="Danger zone" />
        <Panel className="px-4 py-4">
          <p className="mb-3 font-sans text-xs text-ink/70">
            Deleting removes the account and, with the override ticked, its uploads too. To keep the
            papers but destroy the identity, ask the member to use account erasure in Settings.
          </p>
          {isSelf ? (
            <p className="font-sans text-xs text-ink/60">This is your own account.</p>
          ) : (
            <DeleteButton entity="user" id={member.id} label={member.name} />
          )}
        </Panel>
      </section>
    </div>
  );
}
