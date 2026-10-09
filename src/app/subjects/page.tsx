import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeading, Panel } from "@/components/ui";
import { prisma } from "@/lib/db";
import { subjectHref } from "@/lib/links";

export const metadata: Metadata = {
  title: "Subjects",
  description: "Browse subjects across colleges, programs and semesters.",
};

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const subjects = await prisma.subject.findMany({
    where: {
      archived: false,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { code: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
    orderBy: { name: "asc" },
    take: 60,
    include: {
      semester: { include: { branch: { include: { program: { include: { college: true } } } } } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeading eyebrow="Academic structure" title="Subjects" />
      <Panel className="px-4 py-4">
        <form className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-[220px] flex-1">
            <label className="pv-label" htmlFor="q">
              Find a subject
            </label>
            <input id="q" name="q" defaultValue={q ?? ""} className="pv-input" placeholder="e.g. DBMS" />
          </div>
          <button type="submit" className="pv-btn-primary">
            Search
          </button>
        </form>
      </Panel>

      {subjects.length === 0 ? (
        <EmptyState title="No subjects matched." />
      ) : (
        <ul className="flex flex-col gap-2">
          {subjects.map((subject) => {
            const branch = subject.semester.branch;
            const college = branch.program.college;
            return (
              <li key={subject.id}>
                <Link
                  href={subjectHref(
                    college.slug,
                    branch.program.slug,
                    branch.slug,
                    subject.semester.number,
                    subject.slug,
                  )}
                  className="pv-row justify-between hover:bg-cream"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-bold">{subject.name}</span>
                    <span className="block font-sans text-[11px] text-ink/60">
                      {college.shortName} · {branch.program.name} {branch.code} · Semester{" "}
                      {subject.semester.number} · {subject.code}
                    </span>
                  </span>
                  <span className="font-mono text-xs">Open →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
