import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, EmptyState, PageHeading } from "@/components/ui";
import { programBySlug } from "@/server/repositories/academics";
import { branchHref, collegeHref } from "@/lib/links";

type Params = { params: Promise<{ college: string; program: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { college, program } = await params;
  const found = await programBySlug(college, program);
  if (!found) return { title: "Program not found" };
  return {
    title: `${found.name} at ${found.college.shortName}`,
    description: `Branches and question papers for ${found.name} at ${found.college.name}.`,
    alternates: { canonical: `/colleges/${college}/${program}` },
  };
}

export default async function ProgramPage({ params }: Params) {
  const { college: collegeSlug, program: programSlug } = await params;
  const program = await programBySlug(collegeSlug, programSlug);
  if (!program) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: "Colleges", href: "/colleges" },
          { label: program.college.shortName, href: collegeHref(collegeSlug) },
          { label: program.name },
        ]}
      />
      <PageHeading
        eyebrow={program.college.name}
        title={program.name}
        description={`Choose a branch. Branches and semesters are configured per college, not hardcoded.`}
      />

      {program.branches.length === 0 ? (
        <EmptyState title="No branches configured yet." body="A college admin can add branches for this program." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {program.branches.map((branch) => (
            <Link
              key={branch.id}
              href={branchHref(collegeSlug, programSlug, branch.slug)}
              className="pv-card-interactive block px-4 py-4"
            >
              <p className="pv-eyebrow">{branch.code}</p>
              <h2 className="mt-1 font-mono text-base font-bold leading-tight">{branch.name}</h2>
              <p className="mt-3 font-mono text-xs underline decoration-2 underline-offset-2">
                Open semesters →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
