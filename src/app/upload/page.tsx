import Link from "next/link";
import type { Metadata } from "next";
import { PageHeading, Panel } from "@/components/ui";
import { UploadForm, type CollegeOption, type UploadPrefill } from "@/components/UploadForm";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Upload a paper", robots: { index: false } };

type Search = { subject?: string; examType?: string; year?: string };

export default async function UploadPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading eyebrow="Contribute" title="Sign in to upload" />
        <Panel className="px-5 py-6">
          <p className="text-sm">
            Uploads are tied to a contributor account so moderators can verify them.
          </p>
          <p className="mt-2 text-sm text-ink/70">Have a paper classmates need? Keep a clear copy with its header and all pages. You can preview it, correct detected details and track moderator review in My Library. Only share material you have permission to upload.</p>
          <Link href={`/login?next=${encodeURIComponent(uploadPath(search))}`} className="pv-btn-primary mt-4">
            Sign in
          </Link>
          <Link href="/requests" className="pv-link ml-4">See papers wanted</Link>
          <p className="mt-3 text-xs text-ink/70">No account is needed to browse or read public papers.</p>
        </Panel>
      </div>
    );
  }

  const colleges = await prisma.college.findMany({
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    include: {
      examTypes: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } },
      programs: {
        where: { archived: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          branches: {
            where: { archived: false },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              code: true,
              semesters: {
                orderBy: { number: "asc" },
                select: {
                  id: true,
                  number: true,
                  subjects: {
                    where: { archived: false },
                    orderBy: { name: "asc" },
                    select: { id: true, name: true, code: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const prefill = await resolvePrefill(search, colleges as CollegeOption[]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow="Contribute"
        title="Upload a paper"
        description="Add a past or released question paper. Moderators review every submission before it is published."
      />
      <Panel className="w-full px-4 py-4 sm:px-6 sm:py-6">
        <UploadForm colleges={colleges as CollegeOption[]} prefill={prefill} />
      </Panel>
    </div>
  );
}

function uploadPath(search: Search) {
  const params = new URLSearchParams();
  for (const key of ["subject", "examType", "year"] as const) {
    const value = search[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/upload?${query}` : "/upload";
}

/**
 * Turns ?subject=&examType=&year= into starting values for the form. Anything
 * unknown or out of range is simply dropped, so a stale link never breaks the
 * page; the user can change every field before submitting.
 */
async function resolvePrefill(search: Search, colleges: CollegeOption[]): Promise<UploadPrefill | undefined> {
  const subjectId = typeof search.subject === "string" ? search.subject.slice(0, 64) : "";
  if (!subjectId) return undefined;
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, archived: false, semester: { branch: { archived: false } } },
    select: {
      id: true,
      name: true,
      code: true,
      semester: {
        select: {
          id: true,
          number: true,
          branch: { select: { id: true, code: true, program: { select: { id: true, collegeId: true } } } },
        },
      },
    },
  });
  if (!subject) return undefined;
  const program = subject.semester.branch.program;
  const college = colleges.find((c) => c.id === program.collegeId);
  if (!college) return undefined;

  const examCode = typeof search.examType === "string" ? search.examType.toLowerCase() : "";
  const examType = college.examTypes.find((e) => e.code.toLowerCase() === examCode);
  const candidateYear = Number(search.year);
  const year = Number.isInteger(candidateYear) && candidateYear >= 1990 && candidateYear <= new Date().getFullYear() ? candidateYear : undefined;

  return {
    collegeId: college.id,
    programId: program.id,
    branchId: subject.semester.branch.id,
    semesterId: subject.semester.id,
    subjectId: subject.id,
    examTypeId: examType?.id,
    academicYear: year,
    summary: `${subject.name} (${subject.code}) · ${subject.semester.branch.code} · Semester ${subject.semester.number}${
      examType ? ` · ${examType.name}` : ""
    }${year ? ` · ${year}` : ""}`,
  };
}
