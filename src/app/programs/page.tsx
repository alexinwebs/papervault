import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeading, Panel } from "@/components/ui";
import { prisma } from "@/lib/db";
import { programHref } from "@/lib/links";

export const metadata: Metadata = {
  title: "Programs",
  description: "Higher-education programs covered by the PaperVault archive.",
};

export default async function ProgramsPage() {
  const programs = await prisma.program.findMany({
    where: { archived: false },
    orderBy: [{ name: "asc" }],
    include: { college: true, branches: { where: { archived: false } } },
  });

  const grouped = new Map<string, typeof programs>();
  for (const program of programs) {
    grouped.set(program.name, [...(grouped.get(program.name) ?? []), program]);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow="Academic structure"
        title="Programs"
        description="Programs, and the colleges that offer them. Structures are configured per college."
      />
      {programs.length === 0 ? (
        <EmptyState title="No programs configured yet." />
      ) : (
        <div className="flex flex-col gap-4">
          {[...grouped.entries()].map(([name, list]) => (
            <Panel key={name} className="px-4 py-4">
              <h2 className="pv-section-title">{name}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {list.map((program) => (
                  <li key={program.id} className="pv-row justify-between">
                    <Link
                      href={programHref(program.college.slug, program.slug)}
                      prefetch={false}
                      className="pv-link-title font-mono text-sm"
                    >
                      {program.college.shortName}
                    </Link>
                    <span className="font-sans text-[11px] text-ink/60">
                      {program.branches.length} branches · {program.semesterCount} semesters
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
