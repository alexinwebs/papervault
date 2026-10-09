import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { BackBar, Chip, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { adminCollegeList } from "@/server/services/admin";
import { AdminForm, DeleteButton } from "../forms";
import { createCollegeAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Colleges · Admin", robots: { index: false } };

export default async function AdminCollegesPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; deleted?: string }>;
}) {
  const actor = await getSessionUser();
  if (!actor) redirect("/login?next=/admin/colleges");
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const [colleges, { added, deleted }] = await Promise.all([adminCollegeList(), searchParams]);
  const flash = added ? `${added} added.` : deleted || null;

  return (
    <div className="flex flex-col gap-6">
      <BackBar fallback="/admin" />
      <PageHeading
        eyebrow="Platform admin"
        title="Colleges"
        description={`${colleges.length} colleges on the platform. Adding one seeds the default CT, ST, Mid-Sem and End-Sem exam types.`}
      />

      {flash ? (
        <p role="status" className="pv-panel-flat bg-mint px-3 py-2 font-mono text-xs">
          {flash}
        </p>
      ) : null}

      <section>
        <SectionHeader title="Add a college" />
        <Panel className="px-4 py-4">
          <AdminForm
            idPrefix="new-college"
            action={createCollegeAction}
            submitLabel="Add college"
            fields={[
              {
                name: "name",
                label: "Full name",
                required: true,
                span: 2,
                placeholder: "Raj Kumar Goel Institute of Technology",
              },
              { name: "shortName", label: "Short name", required: true, placeholder: "RKGIT" },
              {
                name: "slug",
                label: "URL slug (optional)",
                placeholder: "auto-generated from the name",
              },
              { name: "city", label: "City", required: true, placeholder: "Ghaziabad" },
              { name: "state", label: "State", required: true, placeholder: "Uttar Pradesh" },
              {
                name: "university",
                label: "Affiliating university",
                required: true,
                span: 2,
                placeholder: "Dr. A.P.J. Abdul Kalam Technical University",
              },
              { name: "about", label: "About", type: "textarea", span: 2 },
              {
                name: "accent",
                label: "Accent",
                type: "select",
                defaultValue: "blue",
                options: ["blue", "mint", "pink", "lavender", "yellow", "cream"].map((value) => ({
                  value,
                  label: value,
                })),
              },
              { name: "verified", label: "Mark as verified", type: "checkbox" },
              {
                name: "featured",
                label: "Pin to the top of every list (home campus)",
                type: "checkbox",
              },
            ]}
          />
        </Panel>
      </section>

      <section>
        <SectionHeader title="All colleges" href="/colleges" hrefLabel="Public directory" />
        <ul className="flex flex-col gap-2">
          {colleges.map((college) => {
            const branches = college.programs.reduce((sum, p) => sum + p.branches.length, 0);
            return (
              <li key={college.id} className="pv-panel-flat flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/admin/colleges/${college.id}`}
                    prefetch={false}
                    className="pv-link font-mono text-sm"
                  >
                    {college.name}
                  </Link>
                  <span className="flex flex-wrap gap-2">
                    {college.featured ? <Chip accent="yellow">home campus</Chip> : null}
                    {college.verified ? <Chip accent="mint">verified</Chip> : <Chip>unverified</Chip>}
                  </span>
                </div>
                <p className="font-sans text-[11px] text-ink/60">
                  {college.shortName} · {college.city}, {college.state} · {college.university}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink/60">
                    {college.programs.length} programs · {branches} branches ·{" "}
                    {college.examTypes.length} exam types · {college._count.users} members
                  </span>
                  <DeleteButton entity="college" id={college.id} label={college.shortName} compact />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
