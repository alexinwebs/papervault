import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { Breadcrumbs, Chip, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { adminCollegeDetail } from "@/server/services/admin";
import { AdminForm, DeleteButton } from "../../forms";
import {
  createBranchAction,
  createExamTypeAction,
  createProgramAction,
  updateCollegeAction,
} from "@/server/actions/admin";
import { ExamTypeRow, ProgramRow } from "./rows";

export const metadata: Metadata = { title: "Manage college · Admin", robots: { index: false } };

export default async function AdminCollegePage({
  params,
}: {
  params: Promise<{ collegeId: string }>;
}) {
  const { collegeId } = await params;
  const actor = await getSessionUser();
  if (!actor) redirect(`/login?next=/admin/colleges/${collegeId}`);
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const college = await adminCollegeDetail(collegeId);
  if (!college) notFound();

  const branchOptions = college.programs.flatMap((program) =>
    program.branches.map((branch) => ({
      value: branch.id,
      label: `${program.name} · ${branch.code}`,
    })),
  );
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Colleges", href: "/admin/colleges" },
          { label: college.shortName },
        ]}
      />
      <PageHeading
        eyebrow="Manage college"
        title={college.name}
        description={`${college.city}, ${college.state} · ${college.university}`}
      />

      <section>
        <SectionHeader title="College details" href={`/colleges/${college.slug}`} hrefLabel="View public page" />
        <Panel className="px-4 py-4">
          <AdminForm
            idPrefix="edit-college"
            action={updateCollegeAction}
            submitLabel="Save changes"
            resetOnSuccess={false}
            hidden={{ collegeId: college.id }}
            fields={[
              { name: "name", label: "Full name", required: true, span: 2, defaultValue: college.name },
              { name: "shortName", label: "Short name", required: true, defaultValue: college.shortName },
              { name: "slug", label: "URL slug", defaultValue: college.slug },
              { name: "city", label: "City", required: true, defaultValue: college.city },
              { name: "state", label: "State", required: true, defaultValue: college.state },
              {
                name: "university",
                label: "Affiliating university",
                required: true,
                span: 2,
                defaultValue: college.university,
              },
              {
                name: "about",
                label: "About",
                type: "textarea",
                span: 2,
                defaultValue: college.about ?? "",
              },
              {
                name: "accent",
                label: "Accent",
                type: "select",
                defaultValue: college.accent,
                options: ["blue", "mint", "pink", "lavender", "yellow", "cream"].map((value) => ({
                  value,
                  label: value,
                })),
              },
              {
                name: "verified",
                label: "Mark as verified",
                type: "checkbox",
                defaultValue: college.verified ? "true" : "",
              },
              {
                name: "featured",
                label: "Pin to the top of every list (home campus)",
                type: "checkbox",
                defaultValue: college.featured ? "true" : "",
              },
            ]}
          />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="px-4 py-4">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.12em]">Add a program</h3>
          <AdminForm
            idPrefix="new-program"
            action={createProgramAction}
            submitLabel="Add program"
            columns={1}
            hidden={{ collegeId: college.id }}
            fields={[
              { name: "name", label: "Name", required: true, placeholder: "B.Tech" },
              {
                name: "level",
                label: "Level",
                type: "select",
                defaultValue: "UG",
                options: [
                  { value: "UG", label: "Undergraduate" },
                  { value: "PG", label: "Postgraduate" },
                ],
              },
              {
                name: "semesterCount",
                label: "Semesters",
                type: "number",
                required: true,
                defaultValue: 8,
              },
            ]}
          />
        </Panel>

        <Panel className="px-4 py-4">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.12em]">Add an exam type</h3>
          <AdminForm
            idPrefix="new-examtype"
            action={createExamTypeAction}
            submitLabel="Add exam type"
            columns={1}
            hidden={{ collegeId: college.id }}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "PUT" },
              { name: "name", label: "Display name", required: true, placeholder: "Pre-University Test" },
              { name: "sortOrder", label: "Sort order", type: "number", defaultValue: 5 },
            ]}
          />
          <ul className="mt-4 flex flex-col gap-2">
            {college.examTypes.map((examType) => (
              <li key={examType.id}>
                <ExamTypeRow examType={examType} collegeId={college.id} />
              </li>
            ))}
            {college.examTypes.length === 0 ? (
              <li className="font-sans text-xs text-ink/55">
                No exam types yet. Sessions and papers hang off these.
              </li>
            ) : null}
          </ul>
        </Panel>

        {branchOptions.length > 0 ? null : (
          <Panel className="px-4 py-4 lg:col-span-2">
            <p className="font-sans text-xs text-ink/60">
              Add a program first — branches, semesters and subjects hang off it.
            </p>
          </Panel>
        )}

        {college.programs.length > 0 ? (
          <Panel className="px-4 py-4">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.12em]">Add a branch</h3>
            <AdminForm
              idPrefix="new-branch"
              action={createBranchAction}
              submitLabel="Add branch"
              columns={1}
              hidden={{ collegeId: college.id }}
              fields={[
                {
                  name: "programId",
                  label: "Program",
                  type: "select",
                  required: true,
                  options: college.programs.map((program) => ({
                    value: program.id,
                    label: `${program.name} (${program.semesterCount} sem)`,
                  })),
                },
                {
                  name: "name",
                  label: "Name",
                  required: true,
                  placeholder: "Computer Science and Engineering",
                },
                { name: "code", label: "Code", required: true, placeholder: "CSE" },
              ]}
            />
          </Panel>
        ) : null}

      </section>

      <section>
        <SectionHeader title="Degrees, branches and subjects" />
        <div className="flex flex-col gap-4">
          {college.programs.map((program) => (
            <ProgramRow key={program.id} program={program} collegeId={college.id} />
          ))}
          {college.programs.length === 0 ? (
            <p className="font-sans text-xs text-ink/60">
              No degrees yet. Add one above — branches, semesters and subjects hang off it.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
