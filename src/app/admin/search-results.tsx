import Link from "next/link";
import { Chip, Panel } from "@/components/ui";
import type { controlCenterSearch } from "@/server/services/admin";

type Results = NonNullable<Awaited<ReturnType<typeof controlCenterSearch>>>;

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/70">
        {title} <Chip>{count}</Chip>
      </h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function Row({ href, primary, secondary }: { href: string; primary: string; secondary: string }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 py-1">
      <Link href={href} prefetch={false} className="pv-link font-mono text-xs">
        {primary}
      </Link>
      <span className="font-sans text-[11px] text-ink/60">{secondary}</span>
    </li>
  );
}

/**
 * Cross-entity search output. Every row links to the screen where that thing
 * can actually be edited, so the search box doubles as the admin index.
 */
export function ControlSearchResults({ results }: { results: Results }) {
  const total =
    results.colleges.length +
    results.programs.length +
    results.branches.length +
    results.subjects.length +
    results.members.length +
    results.papers.length;

  return (
    <Panel className="px-4 py-4">
      <p className="mb-3 font-sans text-xs text-ink/60">
        {total === 0
          ? `Nothing matches “${results.query}”.`
          : `${total} match${total === 1 ? "" : "es"} for “${results.query}”. Each group is capped at eight.`}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Group title="Colleges" count={results.colleges.length}>
          {results.colleges.map((college) => (
            <Row
              key={college.id}
              href={`/admin/colleges/${college.id}`}
              primary={college.shortName}
              secondary={`${college.name} · ${college.city}`}
            />
          ))}
        </Group>

        <Group title="Degrees" count={results.programs.length}>
          {results.programs.map((program) => (
            <Row
              key={program.id}
              href={`/admin/colleges/${program.college.id}`}
              primary={program.name}
              secondary={`${program.college.shortName} · ${program.level} · ${program.semesterCount} sem`}
            />
          ))}
        </Group>

        <Group title="Branches" count={results.branches.length}>
          {results.branches.map((branch) => (
            <Row
              key={branch.id}
              href={`/admin/branches/${branch.id}`}
              primary={`${branch.code} — ${branch.name}`}
              secondary={`${branch.program.college.shortName} · ${branch.program.name}`}
            />
          ))}
        </Group>

        <Group title="Subjects" count={results.subjects.length}>
          {results.subjects.map((subject) => (
            <Row
              key={subject.id}
              href={`/admin/branches/${subject.semester.branch.id}#sem-${subject.semester.number}`}
              primary={`${subject.code} — ${subject.name}`}
              secondary={`${subject.semester.branch.program.college.shortName} · ${subject.semester.branch.code} · Sem ${subject.semester.number}`}
            />
          ))}
        </Group>

        <Group title="Members" count={results.members.length}>
          {results.members.map((member) => (
            <Row
              key={member.id}
              href={`/admin/users/${member.id}`}
              primary={member.name}
              secondary={`${member.email} · ${member.role.replace(/_/g, " ").toLowerCase()}`}
            />
          ))}
        </Group>

        <Group title="Papers" count={results.papers.length}>
          {results.papers.map((paper) => (
            <Row
              key={paper.id}
              href={`/moderation/${paper.id}`}
              primary={paper.title}
              secondary={paper.status.replace(/_/g, " ").toLowerCase()}
            />
          ))}
        </Group>
      </div>
    </Panel>
  );
}
