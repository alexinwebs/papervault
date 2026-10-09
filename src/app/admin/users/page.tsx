import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, EmptyState, PageHeading, Pagination, Panel } from "@/components/ui";
import { adminCollegeList, adminUserList } from "@/server/services/admin";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { RoleForm } from "../role-form";
import { AdminForm, DeleteButton } from "../forms";
import { createMemberAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Members · Admin", robots: { index: false } };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/users");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const { q = "", page = "1" } = await searchParams;
  const [users, colleges] = await Promise.all([
    adminUserList({ q: q || undefined, page: Number(page) }),
    adminCollegeList(),
  ]);
  const collegeOptions = colleges.map((college) => ({ id: college.id, name: college.shortName }));

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Members"
        description={`${users.total} accounts. Create members, change roles and tenancy, ban, verify email, clear 2FA or delete.`}
      />

      <details className="pv-panel px-4 py-4">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.12em]">
          Create a member
        </summary>
        <div className="mt-3">
          <AdminForm
            idPrefix="new-member"
            action={createMemberAction}
            submitLabel="Create member"
            fields={[
              { name: "name", label: "Name", required: true, placeholder: "Priya Rathi" },
              { name: "email", label: "Email", required: true, placeholder: "priya@example.edu" },
              {
                name: "password",
                label: "Temporary password",
                required: true,
                hint: "At least 10 characters with a letter and a number. Ask them to change it.",
              },
              {
                name: "role",
                label: "Role",
                type: "select",
                defaultValue: "STUDENT",
                options: [
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
                defaultValue: "",
                options: [
                  { value: "", label: "No college" },
                  ...colleges.map((college) => ({ value: college.id, label: college.shortName })),
                ],
              },
              {
                name: "trustLevel",
                label: "Trust level",
                type: "select",
                defaultValue: "NEW",
                options: [
                  { value: "NEW", label: "New" },
                  { value: "VERIFIED_CONTRIBUTOR", label: "Verified contributor" },
                  { value: "TRUSTED_CONTRIBUTOR", label: "Trusted contributor" },
                ],
              },
              {
                name: "emailVerified",
                label: "Mark the email as already confirmed",
                type: "checkbox",
              },
            ]}
          />
        </div>
      </details>

      <Panel className="px-4 py-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="admin-user-q" className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em]">
              Search name or email
            </label>
            <input id="admin-user-q" name="q" defaultValue={q} className="pv-input" />
          </div>
          <button type="submit" className="pv-btn-secondary px-4 py-2 text-xs">
            Search
          </button>
        </form>
      </Panel>

      <ul className="flex flex-col gap-2">
        {users.rows.map((user) => (
          <li key={user.id} className="pv-panel-flat flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/admin/users/${user.id}`}
                prefetch={false}
                className="pv-link-title font-mono text-sm"
              >
                {user.name}
              </Link>
              <span className="flex flex-wrap items-center gap-2">
                {user.bannedAt ? <Chip accent="pink">banned</Chip> : null}
                <Chip>{user.role.replace(/_/g, " ").toLowerCase()}</Chip>
              </span>
            </div>
            <p className="break-all font-sans text-[11px] text-ink/60">
              {user.email} · {user.college?.shortName ?? "no college"} · {user._count.papers} uploads ·
              joined {formatDate(user.createdAt)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <RoleForm
                userId={user.id}
                role={user.role}
                collegeId={user.collegeId ?? ""}
                colleges={collegeOptions}
              />
              <Link
                href={`/admin/users/${user.id}`}
                prefetch={false}
                className="pv-btn-secondary px-2 py-1 text-[11px] no-underline"
              >
                Manage
              </Link>
              {user.id === actor.id ? (
                <span className="font-sans text-[11px] text-ink/55">This is you.</span>
              ) : (
                <DeleteButton entity="user" id={user.id} label={user.name} compact />
              )}
            </div>
          </li>
        ))}
      </ul>

      {users.total === 0 ? (
        <EmptyState title="No accounts match that search" body="Try a different name or email." />
      ) : (
        <Pagination
          page={users.page}
          pages={users.pages}
          total={users.total}
          perPage={users.perPage}
          params={{ q }}
          label="accounts"
        />
      )}
    </div>
  );
}
