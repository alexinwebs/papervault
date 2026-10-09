/** Shared URL builders so every page uses the same clean, shareable routes. */
export const collegeHref = (slug: string) => `/colleges/${slug}`;
export const programHref = (college: string, program: string) => `/colleges/${college}/${program}`;
export const branchHref = (college: string, program: string, branch: string) =>
  `/colleges/${college}/${program}/${branch}`;
export const semesterHref = (college: string, program: string, branch: string, semester: number) =>
  `/colleges/${college}/${program}/${branch}/semester-${semester}`;
export const subjectHref = (
  college: string,
  program: string,
  branch: string,
  semester: number,
  subject: string,
) => `/colleges/${college}/${program}/${branch}/semester-${semester}/${subject}`;
export const paperHref = (id: string) => `/papers/${id}`;

type PaperContext = {
  paperSet: {
    label: string;
    examSession: {
      academicYear: number;
      sessionLabel: string | null;
      examType: { code: string; name: string };
      subject: {
        id: string;
        name: string;
        code: string;
        slug: string;
        semester: {
          number: number;
          branch: {
            name: string;
            code: string;
            slug: string;
            program: {
              name: string;
              slug: string;
              college: { name: string; shortName: string; slug: string };
            };
          };
        };
      };
    };
  };
};

/** Flattens the nested academic chain of a paper into display-ready fields. */
export function paperContext(paper: PaperContext) {
  const session = paper.paperSet.examSession;
  const subject = session.subject;
  const semester = subject.semester;
  const branch = semester.branch;
  const program = branch.program;
  const college = program.college;
  return {
    college,
    program,
    branch,
    semesterNumber: semester.number,
    subject,
    examType: session.examType,
    academicYear: session.academicYear,
    sessionLabel: session.sessionLabel,
    setLabel: paper.paperSet.label,
    subjectUrl: subjectHref(college.slug, program.slug, branch.slug, semester.number, subject.slug),
    breadcrumbLabel: `${college.shortName} · ${program.name} ${branch.code} · Semester ${semester.number}`,
  };
}
