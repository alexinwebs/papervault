import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/server/authz";
import { Forbidden } from "@/components/Forbidden";
import { Breadcrumbs, Chip, PageHeading, Panel, SectionHeader } from "@/components/ui";
import { adminBranchDetail, emptyExamSlots } from "@/server/services/admin";
import { AdminForm, DeleteButton } from "../../forms";
import {
  createSemesterAction,
  createSubjectAction,
  updateBranchAction,
} from "@/server/actions/admin";
import { CurriculumPanel, ImportPanel, SubjectRow } from "./panels";

export const metadata: Metadata = { title: "Manage branch · Admin", robots: { index: false } };

export default async function AdminBranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { branchId } = await params;
  const actor = await getSessionUser();
  if (!actor) redirect(`/login?next=/admin/branches/${branchId}`);
  if (!isPlatformAdmin(actor.role)) return <Forbidden area="Admin" />;

  const [branch, slots, { done }] = await Promise.all([
    adminBranchDetail(branchId),
    emptyExamSlots(branchId),
    searchParams,
  ]);
  if (!branch) notFound();

  const college = branch.program.college;
  const subjectTotal = branch.semesters.reduce((n, s) => n + s._count.subjects, 0);
  const semesterOptions = branch.semesters.map((semester) => ({
    value: semester.id,
    label: `Semester ${semester.number}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Control center", href: "/admin" },
          { label: "Colleges", href: "/admin/colleges" },
          { label: college.shortName, href: `/admin/colleges/${college.id}` },
          { label: `${branch.program.name} ${branch.code}` },
        ]}
      />
      <PageHeading
        eyebrow={`${college.shortName} · ${branch.program.name}`}
        title={`${branch.code} — ${branch.name}`}
        description={`${branch.semesters.length} semesters · ${subjectTotal} subjects${
          branch.archived ? " · archived" : ""
        }`}
      />

      {done ? (
        <p role="status" className="pv-panel-flat bg-mint px-3 py-2 font-mono text-xs">
          {done}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="px-4 py-4">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.12em]">Branch details</h2>
          <AdminForm
            idPrefix="edit-branch"
            action={updateBranchAction}
            submitLabel="Save branch"
            resetOnSuccess={false}
            columns={1}
            hidden={{ branchId: branch.id, collegeId: college.id }}
            fields={[
              { name: "name", label: "Name", required: true, defaultValue: branch.name },
              { name: "code", label: "Code", required: true, defaultValue: branch.code },
              { name: "slug", label: "URL slug", defaultValue: branch.slug },
              {
                name: "archived",
                label: "Archived (hidden from students, papers kept)",
                type: "checkbox",
                defaultValue: branch.archived ? "true" : "",
              },
            ]}
          />
          <div className="mt-4 border-t-2 border-ink/20 pt-3">
            <DeleteButton
              entity="branch"
              id={branch.id}
              label={`${branch.code} and everything under it`}
              collegeId={college.id}
            />
          </div>
        </Panel>

        <CurriculumPanel
          branchId={branch.id}
          collegeId={college.id}
          template={branch.template}
          existing={subjectTotal}
        />

        <Panel className="px-4 py-4">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.12em]">Add a semester</h2>
          <AdminForm
            idPrefix="new-semester"
            action={createSemesterAction}
            submitLabel="Add semester"
            columns={1}
            hidden={{ branchId: branch.id, collegeId: college.id }}
            fields={[
              {
                name: "number",
                label: "Semester number",
                type: "number",
                required: true,
                hint: `This degree runs ${branch.program.semesterCount} semesters.`,
              },
            ]}
          />
        </Panel>

        {semesterOptions.length > 0 ? (
          <Panel className="px-4 py-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.12em]">Add one subject</h2>
            <AdminForm
              idPrefix="new-subject"
              action={createSubjectAction}
              submitLabel="Add subject"
              columns={1}
              hidden={{ collegeId: college.id }}
              fields={[
                {
                  name: "semesterId",
                  label: "Semester",
                  type: "select",
                  required: true,
                  options: semesterOptions,
                },
                { name: "code", label: "Subject code", required: true, placeholder: "KCS501" },
                {
                  name: "name",
                  label: "Subject name",
                  required: true,
                  placeholder: "Database Management Systems",
                },
              ]}
            />
          </Panel>
        ) : null}

        <div className="lg:col-span-2">
          <ImportPanel
            branchId={branch.id}
            collegeId={college.id}
            semesterCount={branch.program.semesterCount}
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Subjects by semester"
          href={`/colleges/${college.slug}/${branch.program.slug}/${branch.slug}`}
          hrefLabel="View public page"
        />
        <div className="flex flex-col gap-4">
          {branch.semesters.map((semester) => (
            <Panel key={semester.id} id={`sem-${semester.number}`} className="px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink pb-2">
                <h3 className="flex items-center gap-2 font-display text-base">
                  Semester {semester.number}
                  <Chip>{semester._count.subjects} subjects</Chip>
                </h3>
                <DeleteButton
                  entity="semester"
                  id={semester.id}
                  label={`Semester ${semester.number}`}
                  collegeId={college.id}
                  compact
                />
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {semester.subjects.map((subject) => (
                  <li key={subject.id}>
                    <SubjectRow subject={subject} collegeId={college.id} />
                  </li>
                ))}
                {semester.subjects.length === 0 ? (
                  <li className="font-sans text-xs text-ink/55">
                    No subjects yet. Apply the catalogue or paste a list above.
                  </li>
                ) : null}
              </ul>
            </Panel>
          ))}
          {branch.semesters.length === 0 ? (
            <p className="font-sans text-xs text-ink/60">No semesters yet.</p>
          ) : null}
        </div>
      </section>

      {slots.sessions.length + slots.sets.length > 0 ? (
        <section>
          <SectionHeader title="Empty exam slots" />
          <Panel className="px-4 py-4">
            <p className="mb-3 font-sans text-xs text-ink/70">
              Exam sessions and paper sets are created automatically on the first upload and are
              left behind when a paper is removed. Students never see these, but they can be tidied
              away. Showing up to 50 of each.
            </p>
            <ul className="flex flex-col gap-2">
              {slots.sessions.map((session) => (
                <li key={session.id} className="pv-row flex-wrap justify-between gap-2">
                  <span className="font-sans text-xs">
                    <span className="font-mono">{session.subject.code}</span> ·{" "}
                    {session.examType.code} · {session.academicYear}
                    {session.sessionLabel ? ` · ${session.sessionLabel}` : ""}
                  </span>
                  <DeleteButton
                    entity="examSession"
                    id={session.id}
                    label={`${session.subject.code} ${session.examType.code} ${session.academicYear}`}
                    collegeId={college.id}
                    compact
                  />
                </li>
              ))}
              {slots.sets.map((set) => (
                <li key={set.id} className="pv-row flex-wrap justify-between gap-2">
                  <span className="font-sans text-xs">
                    <span className="font-mono">{set.examSession.subject.code}</span> ·{" "}
                    {set.examSession.examType.code} · {set.examSession.academicYear} · {set.label}
                  </span>
                  <DeleteButton
                    entity="paperSet"
                    id={set.id}
                    label={`${set.label} (${set.examSession.subject.code})`}
                    collegeId={college.id}
                    compact
                  />
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
