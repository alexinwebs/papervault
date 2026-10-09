import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, EmptyState, PageHeading } from "@/components/ui";
import { semesterByNumber } from "@/server/repositories/academics";
import { branchHref, collegeHref, programHref, subjectHref } from "@/lib/links";

type Params = {
  params: Promise<{ college: string; program: string; branch: string; semester: string }>;
};

function parseSemester(value: string) {
  const match = /^semester-(\d{1,2})$/.exec(value);
  return match ? Number(match[1]) : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { semester } = await params;
  const number = parseSemester(semester);
  return { title: number ? `Semester ${number}` : "Semester not found" };
}

export default async function SemesterPage({ params }: Params) {
  const { college: collegeSlug, program: programSlug, branch: branchSlug, semester } = await params;
  const number = parseSemester(semester);
  if (!number) notFound();

  const found = await semesterByNumber(collegeSlug, programSlug, branchSlug, number);
  if (!found) notFound();
  const branch = found.branch;

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: "Colleges", href: "/colleges" },
          { label: branch.program.college.shortName, href: collegeHref(collegeSlug) },
          { label: branch.program.name, href: programHref(collegeSlug, programSlug) },
          { label: branch.code, href: branchHref(collegeSlug, programSlug, branchSlug) },
          { label: `Semester ${number}` },
        ]}
      />
      <PageHeading
        eyebrow={`${branch.program.college.shortName} · ${branch.program.name} ${branch.code}`}
        title={`Semester ${number}`}
        description="Choose a subject to see its papers by exam type and year."
      />

      {found.subjects.length === 0 ? (
        <EmptyState title="No subjects configured for this semester yet." />
      ) : (
        <ul className="flex flex-col gap-2">
          {found.subjects.map((subject) => (
            <li key={subject.id}>
              <Link
                href={subjectHref(collegeSlug, programSlug, branchSlug, number, subject.slug)}
                className="pv-row justify-between hover:bg-cream"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm font-bold">{subject.name}</span>
                  <span className="block font-sans text-[11px] text-ink/60">{subject.code}</span>
                </span>
                <span className="font-mono text-xs">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
