import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, Chip, EmptyState, PageHeading } from "@/components/ui";
import { branchBySlug } from "@/server/repositories/academics";
import { collegeHref, programHref, semesterHref } from "@/lib/links";

type Params = { params: Promise<{ college: string; program: string; branch: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { college, program, branch } = await params;
  const found = await branchBySlug(college, program, branch);
  if (!found) return { title: "Branch not found" };
  return {
    title: `${found.program.name} ${found.code} · ${found.program.college.shortName}`,
    description: `Semesters and question papers for ${found.name} at ${found.program.college.name}.`,
    alternates: { canonical: `/colleges/${college}/${program}/${branch}` },
  };
}

export default async function BranchPage({ params }: Params) {
  const { college: collegeSlug, program: programSlug, branch: branchSlug } = await params;
  const branch = await branchBySlug(collegeSlug, programSlug, branchSlug);
  if (!branch) notFound();

  const current = branch.curricula.find((c) => c.isCurrent) ?? branch.curricula[0];

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: "Colleges", href: "/colleges" },
          { label: branch.program.college.shortName, href: collegeHref(collegeSlug) },
          { label: branch.program.name, href: programHref(collegeSlug, programSlug) },
          { label: branch.code },
        ]}
      />
      <PageHeading
        eyebrow={`${branch.program.college.shortName} · ${branch.program.name}`}
        title={branch.name}
        aside={current ? <Chip accent="lavender">{current.label}</Chip> : undefined}
        description="Pick a semester. Only semesters configured for this branch are shown."
      />

      {branch.semesters.length === 0 ? (
        <EmptyState title="No semesters configured yet." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {branch.semesters.map((semester) => (
            <Link
              key={semester.id}
              href={semesterHref(collegeSlug, programSlug, branchSlug, semester.number)}
              className="pv-card-interactive px-3 py-4 text-center"
            >
              <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink/60">
                Sem
              </span>
              <span className="block font-mono text-2xl font-bold">
                {String(semester.number).padStart(2, "0")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
