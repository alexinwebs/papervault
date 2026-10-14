import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, Chip, Panel, PageHeading } from "@/components/ui";
import { PaperList } from "@/components/PaperRow";
import { RequestPaperButton } from "@/components/PaperActions";
import { subjectBySlug } from "@/server/repositories/academics";
import { publicPapersForSubject } from "@/server/repositories/papers";
import { requestCount } from "@/server/services/requests";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { branchHref, collegeHref, programHref, semesterHref, uploadHref } from "@/lib/links";
import { cx } from "@/lib/utils";

type Params = {
  params: Promise<{
    college: string;
    program: string;
    branch: string;
    semester: string;
    subject: string;
  }>;
  searchParams: Promise<{ exam?: string }>;
};

const parseSemester = (value: string) => {
  const match = /^semester-(\d{1,2})$/.exec(value);
  return match ? Number(match[1]) : null;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await params;
  const number = parseSemester(p.semester);
  if (!number) return { title: "Subject not found" };
  const subject = await subjectBySlug(p.college, p.program, p.branch, number, p.subject);
  if (!subject) return { title: "Subject not found" };
  const college = subject.semester.branch.program.college;
  return {
    title: `${subject.name} papers · ${college.shortName}`,
    description: `Past question papers for ${subject.name} (${subject.code}), ${subject.semester.branch.program.name} ${subject.semester.branch.code}, Semester ${number} at ${college.name}.`,
    alternates: {
      canonical: `/colleges/${p.college}/${p.program}/${p.branch}/${p.semester}/${p.subject}`,
    },
  };
}

export default async function SubjectPage({ params, searchParams }: Params) {
  const p = await params;
  const { exam } = await searchParams;
  const number = parseSemester(p.semester);
  if (!number) notFound();

  const subject = await subjectBySlug(p.college, p.program, p.branch, number, p.subject);
  if (!subject) notFound();

  const branch = subject.semester.branch;
  const college = branch.program.college;
  const [examTypes, papers, user] = await Promise.all([
    prisma.examType.findMany({ where: { collegeId: college.id }, orderBy: { sortOrder: "asc" } }),
    publicPapersForSubject(subject.id, exam),
    getSessionUser(),
  ]);

  const activeExam = examTypes.find((t) => t.code === exam) ?? null;
  const byYear = new Map<number, typeof papers>();
  for (const paper of papers) {
    const year = paper.paperSet.examSession.academicYear;
    byYear.set(year, [...(byYear.get(year) ?? []), paper]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  const requestYear = currentYear - 1;
  const requests = activeExam
    ? await requestCount({ subjectId: subject.id, examTypeId: activeExam.id, academicYear: requestYear })
    : await requestCount({ subjectId: subject.id });

  const tab = (code: string | undefined, label: string) => {
    const href = code
      ? `/colleges/${p.college}/${p.program}/${p.branch}/${p.semester}/${p.subject}?exam=${code}`
      : `/colleges/${p.college}/${p.program}/${p.branch}/${p.semester}/${p.subject}`;
    const active = (code ?? undefined) === (exam ?? undefined);
    return (
      <Link
        key={label}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "pv-chip",
          active ? "bg-navy text-cream" : "bg-cream hover:bg-blue-soft",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: "Colleges", href: "/colleges" },
          { label: college.shortName, href: collegeHref(p.college) },
          { label: branch.program.name, href: programHref(p.college, p.program) },
          { label: branch.code, href: branchHref(p.college, p.program, p.branch) },
          { label: `Sem ${number}`, href: semesterHref(p.college, p.program, p.branch, number) },
          { label: subject.code },
        ]}
      />

      <PageHeading
        eyebrow={`${college.shortName} · ${branch.program.name} ${branch.code} · Semester ${number}`}
        title={subject.name}
        description={`${subject.code}${subject.curriculumVersion ? ` · ${subject.curriculumVersion.label}` : ""}`}
        aside={
          <Link
            href={uploadHref({ subjectId: subject.id, examType: activeExam?.code })}
            className="pv-btn-secondary"
            data-testid="contribute-link"
          >
            Contribute a paper
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {tab(undefined, "All")}
        {examTypes.map((t) => tab(t.code, t.name))}
      </div>

      {papers.length === 0 ? (
        <Panel className="bg-yellow px-5 py-6">
          <p className="pv-eyebrow">Not in the archive yet</p>
          <h2 className="pv-h2 mt-2">
            {subject.code}
            {activeExam ? ` · ${activeExam.name}` : ""} · {requestYear}
          </h2>
          <p className="mt-2 max-w-xl text-sm">
            {requests} student{requests === 1 ? "" : "s"} requested this paper. Add your request so
            contributors from {college.shortName} know it is wanted — or upload the copy you have.
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            {activeExam ? (
              <RequestPaperButton
                subjectId={subject.id}
                examTypeId={activeExam.id}
                academicYear={requestYear}
                signedIn={!!user}
              />
            ) : (
              <p className="font-mono text-xs">Pick an exam type above to request a specific paper.</p>
            )}
            <Link
              href={uploadHref({ subjectId: subject.id, examType: activeExam?.code, year: requestYear })}
              className="pv-btn-secondary"
              data-testid="have-paper-link"
            >
              I have this paper
            </Link>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {years.map((year) => (
            <section key={year}>
              <div className="mb-2 flex items-center gap-3">
                <h2 className="pv-section-title">{year}</h2>
                <Chip>{byYear.get(year)!.length} papers</Chip>
              </div>
              <PaperList papers={byYear.get(year)!} showCollege={false} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
