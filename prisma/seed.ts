/**
 * Development seed data. It exists to demonstrate the whole navigation flow;
 * it is never presented as production statistics.
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage");
const PASSWORD = "papervault123";

/** Minimal single-page PDF so the viewer and download paths work end to end. */
function buildPdf(lines: string[]) {
  const text = lines
    .map((line, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 56 ${740 - i * 26} Td (${line.replace(/[()\\]/g, "")}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

import { curriculumFor } from "../src/data/curriculum";

const EXAM_TYPES = [
  { code: "CT", name: "CT", sortOrder: 1 },
  { code: "ST", name: "ST", sortOrder: 2 },
  { code: "MID_SEM", name: "Mid-Sem", sortOrder: 3 },
  { code: "END_SEM", name: "End-Sem", sortOrder: 4 },
];

/**
 * Subjects are unique per semester by slug. The name makes the nicer URL, and
 * the paper code is only appended when a semester really does carry the same
 * subject name twice.
 */
const subjectSlug = (name: string, code: string, taken: Set<string>) => {
  const base = slugify(name);
  const slug = taken.has(base) ? `${base}-${code.toLowerCase()}` : base;
  taken.add(slug);
  return slug;
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * RKGIT is the primary campus: it is listed first, verified, and carries the
 * deepest curriculum. Everything else is realistic supporting coverage.
 */
const COLLEGES: Array<{
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  university: string;
  verified: boolean;
  featured?: boolean;
  accent: string;
  about?: string;
  tier: "primary" | "full" | "lite";
}> = [
  {
    slug: "raj-kumar-goel-institute-of-technology",
    name: "Raj Kumar Goel Institute of Technology, Ghaziabad",
    shortName: "RKGIT",
    city: "Ghaziabad",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: true,
    featured: true,
    accent: "mint",
    about:
      "Raj Kumar Goel Institute of Technology, Ghaziabad — affiliated to Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow. This is the home campus of the archive: papers are contributed by RKGIT students and verified by campus moderators.",
    tier: "primary",
  },
  {
    slug: "aktu",
    name: "Dr. A.P.J. Abdul Kalam Technical University",
    shortName: "AKTU",
    city: "Lucknow",
    state: "Uttar Pradesh",
    university: "State University",
    verified: true,
    accent: "pink",
    about: "University-level papers shared across all AKTU-affiliated colleges.",
    tier: "full",
  },
  {
    slug: "abes-engineering-college",
    name: "ABES Engineering College",
    shortName: "ABES",
    city: "Ghaziabad",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: true,
    accent: "blue",
    about: "An AKTU-affiliated engineering college in Ghaziabad.",
    tier: "full",
  },
  {
    slug: "kiet-group-of-institutions",
    name: "KIET Group of Institutions",
    shortName: "KIET",
    city: "Ghaziabad",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: true,
    accent: "yellow",
    tier: "lite",
  },
  {
    slug: "gl-bajaj-institute-of-technology-and-management",
    name: "G.L. Bajaj Institute of Technology and Management",
    shortName: "GLBITM",
    city: "Greater Noida",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: true,
    accent: "lavender",
    tier: "lite",
  },
  {
    slug: "jss-academy-of-technical-education-noida",
    name: "JSS Academy of Technical Education, Noida",
    shortName: "JSSATEN",
    city: "Noida",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: false,
    accent: "mint",
    tier: "lite",
  },
  {
    slug: "ajay-kumar-garg-engineering-college",
    name: "Ajay Kumar Garg Engineering College",
    shortName: "AKGEC",
    city: "Ghaziabad",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: false,
    accent: "blue",
    tier: "lite",
  },
  {
    slug: "galgotias-college-of-engineering-and-technology",
    name: "Galgotias College of Engineering and Technology",
    shortName: "GCET",
    city: "Greater Noida",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: false,
    accent: "pink",
    tier: "lite",
  },
  {
    slug: "meerut-institute-of-engineering-and-technology",
    name: "Meerut Institute of Engineering and Technology",
    shortName: "MIET",
    city: "Meerut",
    state: "Uttar Pradesh",
    university: "Dr. A.P.J. Abdul Kalam Technical University",
    verified: false,
    accent: "yellow",
    tier: "lite",
  },
  {
    slug: "amity-university-noida",
    name: "Amity University, Noida",
    shortName: "Amity",
    city: "Noida",
    state: "Uttar Pradesh",
    university: "Private University",
    verified: false,
    accent: "lavender",
    tier: "lite",
  },
  {
    slug: "indian-institute-of-technology-delhi",
    name: "Indian Institute of Technology Delhi",
    shortName: "IIT Delhi",
    city: "New Delhi",
    state: "Delhi",
    university: "Institute of National Importance",
    verified: true,
    accent: "blue",
    tier: "lite",
  },
  {
    slug: "delhi-technological-university",
    name: "Delhi Technological University",
    shortName: "DTU",
    city: "New Delhi",
    state: "Delhi",
    university: "State University",
    verified: false,
    accent: "lavender",
    tier: "lite",
  },
  {
    slug: "netaji-subhas-university-of-technology",
    name: "Netaji Subhas University of Technology",
    shortName: "NSUT",
    city: "New Delhi",
    state: "Delhi",
    university: "State University",
    verified: false,
    accent: "mint",
    tier: "lite",
  },
  {
    slug: "national-institute-of-technology-kurukshetra",
    name: "National Institute of Technology, Kurukshetra",
    shortName: "NIT KKR",
    city: "Kurukshetra",
    state: "Haryana",
    university: "Institute of National Importance",
    verified: false,
    accent: "pink",
    tier: "lite",
  },
  {
    slug: "bennett-university",
    name: "Bennett University",
    shortName: "Bennett",
    city: "Greater Noida",
    state: "Uttar Pradesh",
    university: "Private University",
    verified: false,
    accent: "cream",
    tier: "lite",
  },
];

async function main() {
  // SEED_MODE=catalogue loads colleges, programs, branches, curriculum and exam
  // types only: no accounts, no papers, and it never deletes anything. It is
  // what a fresh production database gets. The default demo mode wipes every
  // table and loads sample users and papers, so it refuses to run in production.
  const catalogueOnly = process.env.SEED_MODE === "catalogue";
  if (catalogueOnly) {
    if ((await prisma.college.count()) > 0) {
      console.log("Catalogue already present; nothing to do.");
      return;
    }
    console.log("Loading the college and curriculum catalogue…");
  } else {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
      throw new Error(
        "Refusing to run the demo seed in production: it deletes every table and creates " +
          "accounts with a published password. Use SEED_MODE=catalogue (npm run db:catalogue).",
      );
    }
    console.log("Resetting seed data…");
  }
  if (!catalogueOnly) await prisma.$transaction([
    // The audit table is append-only (DB trigger); the demo reset is the one
    // sanctioned exception, scoped to this transaction.
    prisma.$executeRaw`SELECT set_config('papervault.allow_audit_delete', 'on', true)`,
    prisma.auditLog.deleteMany(),
    prisma.userReport.deleteMany(),
    prisma.teacherVerificationRequest.deleteMany(),
    prisma.supportTicket.deleteMany(),
    prisma.ticketCounter.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.inboxMessage.deleteMany(),
    prisma.takedownRequest.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.authToken.deleteMany(),
    prisma.session.deleteMany(),
    prisma.report.deleteMany(),
    prisma.paperView.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.paperRequest.deleteMany(),
    prisma.paperEvent.deleteMany(),
    prisma.paperFile.deleteMany(),
    prisma.paper.deleteMany(),
    prisma.paperSet.deleteMany(),
    prisma.examSession.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.semester.deleteMany(),
    prisma.curriculumVersion.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.program.deleteMany(),
    prisma.examType.deleteMany(),
    prisma.user.deleteMany(),
    prisma.college.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const data of COLLEGES) {
    const { tier, ...collegeData } = data;
    const college = await prisma.college.create({ data: collegeData });
    await prisma.examType.createMany({
      data: EXAM_TYPES.map((t) => ({ ...t, collegeId: college.id })),
    });

    // Every college is affiliated to the same university scheme, so every
    // college carries the whole catalogue. `tier` only decides how many papers
    // are seeded against it, not how much taxonomy exists.
    const programs: Array<{
      slug: string;
      name: string;
      level: string;
      semesterCount: number;
      branches: Array<{ code: string; name: string }>;
    }> = [
      {
        slug: "btech",
        name: "B.Tech",
        level: "UG",
        semesterCount: 8,
        branches: [
          { code: "CSE", name: "Computer Science & Engineering" },
          { code: "IT", name: "Information Technology" },
          { code: "AIML", name: "Artificial Intelligence & Machine Learning" },
          { code: "DS", name: "Computer Science & Engineering (Data Science)" },
          { code: "ECE", name: "Electronics & Communication Engineering" },
          { code: "EE", name: "Electrical Engineering" },
          { code: "ME", name: "Mechanical Engineering" },
          { code: "CE", name: "Civil Engineering" },
        ],
      },
      {
        slug: "mtech",
        name: "M.Tech",
        level: "PG",
        semesterCount: 4,
        branches: [
          { code: "CSE", name: "Computer Science & Engineering" },
          { code: "VLSI", name: "VLSI Design" },
        ],
      },
      {
        slug: "mca",
        name: "MCA",
        level: "PG",
        semesterCount: 4,
        branches: [{ code: "MCA", name: "Computer Applications" }],
      },
      {
        slug: "mba",
        name: "MBA",
        level: "PG",
        semesterCount: 4,
        branches: [{ code: "MBA", name: "Business Administration" }],
      },
      {
        slug: "bca",
        name: "BCA",
        level: "UG",
        semesterCount: 6,
        branches: [{ code: "BCA", name: "Computer Applications" }],
      },
      {
        slug: "bba",
        name: "BBA",
        level: "UG",
        semesterCount: 6,
        branches: [{ code: "BBA", name: "Business Administration" }],
      },
    ];

    for (const programData of programs) {
      const program = await prisma.program.create({
        data: {
          collegeId: college.id,
          slug: programData.slug,
          name: programData.name,
          level: programData.level,
          semesterCount: programData.semesterCount,
        },
      });

      for (const branchData of programData.branches) {
        const branch = await prisma.branch.create({
          data: {
            programId: program.id,
            slug: slugify(branchData.code),
            code: branchData.code,
            name: branchData.name,
          },
        });

        const curriculum = await prisma.curriculumVersion.create({
          data: {
            branchId: branch.id,
            label: "Curriculum 2022",
            effectiveYear: 2022,
            isCurrent: true,
          },
        });
        await prisma.curriculumVersion.create({
          data: { branchId: branch.id, label: "Curriculum 2018", effectiveYear: 2018 },
        });

        const catalogue = curriculumFor(programData.slug, branchData.code) ?? {};
        await prisma.semester.createMany({
          data: Array.from({ length: programData.semesterCount }, (_, i) => ({
            branchId: branch.id,
            number: i + 1,
          })),
        });
        const semesters = await prisma.semester.findMany({
          where: { branchId: branch.id },
          select: { id: true, number: true },
        });
        const subjectRows = semesters.flatMap((semester) => {
          const taken = new Set<string>();
          return (catalogue[semester.number] ?? []).map(([name, code]) => ({
            semesterId: semester.id,
            curriculumVersionId: curriculum.id,
            slug: subjectSlug(name, code, taken),
            name,
            code,
          }));
        });
        if (subjectRows.length) await prisma.subject.createMany({ data: subjectRows });
      }
    }
  }

  if (catalogueOnly) {
    console.log(`Catalogue loaded: ${COLLEGES.length} colleges. Create an admin with npm run admin:create.`);
    return;
  }

  const primary = await prisma.college.findUniqueOrThrow({
    where: { slug: "raj-kumar-goel-institute-of-technology" },
  });

  const [admin, moderator, otherModerator, ...students] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@papervault.dev",
        name: "Platform Admin",
        passwordHash,
        role: "PLATFORM_ADMIN",
        trustLevel: "TRUSTED_CONTRIBUTOR",
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "moderator@papervault.dev",
        name: "Neha Verma",
        passwordHash,
        role: "MODERATOR",
        collegeId: primary.id,
        trustLevel: "TRUSTED_CONTRIBUTOR",
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "collegeadmin@papervault.dev",
        name: "Dr. S. Mehra",
        passwordHash,
        role: "COLLEGE_ADMIN",
        collegeId: primary.id,
        emailVerifiedAt: new Date(),
      },
    }),
    ...[
      ["student@papervault.dev", "Abbas Ansari"],
      ["raj@papervault.dev", "Raj Sharma"],
      ["ananya@papervault.dev", "Ananya Patel"],
      ["sameer@papervault.dev", "Sameer Khan"],
      ["priya@papervault.dev", "Priya Rathi"],
      ["aditya@papervault.dev", "Aditya Rao"],
    ].map(([email, name], i) =>
      prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          collegeId: primary.id,
          trustLevel: i < 2 ? "VERIFIED_CONTRIBUTOR" : "NEW",
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  ]);

  const currentYear = new Date().getFullYear();
  const allSubjects = await prisma.subject.findMany({
    orderBy: [{ semesterId: "asc" }, { code: "asc" }],
    include: {
      semester: { include: { branch: { include: { program: { include: { college: true } } } } } },
    },
  });
  const examTypes = await prisma.examType.findMany();

  // Every college carries the full taxonomy, which is thousands of subjects.
  // Seeding a paper against each one would produce tens of thousands of PDFs,
  // so each college gets a deterministic, evenly spread slice. Coverage still
  // reaches every program, branch and semester.
  const stride: Record<string, number> = { primary: 6, full: 17, lite: 37 };
  // The home campus DBMS page is the walkthrough everybody lands on, so it is
  // always carried by the slice and never has an exam slot skipped.
  const isShowcase = (subject: (typeof allSubjects)[number]) =>
    subject.code === "KCS501" && subject.semester.branch.program.college.featured;
  const seenPerCollege = new Map<string, number>();
  const subjects = allSubjects.filter((subject) => {
    const college = subject.semester.branch.program.college;
    const tier = college.featured ? "primary" : college.verified ? "full" : "lite";
    const seen = seenPerCollege.get(college.id) ?? 0;
    seenPerCollege.set(college.id, seen + 1);
    return isShowcase(subject) || seen % stride[tier] === 0;
  });

  const semesterTotal = await prisma.semester.count();
  let created = 0;
  for (const subject of subjects) {
    const college = subject.semester.branch.program.college;
    const collegeExamTypes = examTypes.filter((t) => t.collegeId === college.id);

    // The home campus and the other deep colleges carry two academic years;
    // the rest carry one, so the seed stays fast to generate and to browse.
    const years = college.featured ? [currentYear - 1, currentYear - 2] : [currentYear - 1];
    for (const year of years) {
      for (const examType of collegeExamTypes) {
        // Keep the seed realistic: not every slot exists.
        if (!isShowcase(subject) && (created + examType.sortOrder + year) % 3 === 0) continue;

        const session = await prisma.examSession.create({
          data: {
            subjectId: subject.id,
            examTypeId: examType.id,
            academicYear: year,
            sessionLabel: examType.code === "END_SEM" ? `Even ${year}-${String(year + 1).slice(2)}` : null,
          },
        });
        const set = await prisma.paperSet.create({ data: { examSessionId: session.id } });
        const uploader = students[created % students.length];
        // The same lines feed the PDF and the extracted-text column, so the
        // full-text search fallback has realistic content to match on.
        const pdfLines = [
          `${college.shortName} — ${subject.name}`,
          `${subject.semester.branch.program.name} ${subject.semester.branch.code} · Semester ${subject.semester.number}`,
          `${examType.name} · ${year} · Set A`,
          `Paper code: ${subject.code}/${examType.code}/${year}`,
          "",
          "Q1. Attempt any four parts.",
          "   (a) Define normalization and explain 3NF with an example.",
          "   (b) Differentiate between DELETE, TRUNCATE and DROP.",
          "   (c) Explain ACID properties of a transaction.",
          "   (d) Write the relational algebra for a natural join.",
          "",
          "Q2. Explain two-phase locking and draw a conflict-serializable schedule.",
          "",
          "Seeded development document — not a real examination paper.",
        ];
        const bytes = buildPdf(pdfLines);
        const paper = await prisma.paper.create({
          data: {
            paperSetId: set.id,
            title: subject.name,
            status: "PUBLISHED",
            examClassification: "PAST",
            verification: created % 4 === 0 ? "COLLEGE_VERIFIED" : created % 3 === 0 ? "COMMUNITY_VERIFIED" : "MODERATOR_VERIFIED",
            uploadedById: uploader.id,
            reviewedById: moderator.id,
            publishedAt: new Date(Date.now() - ((created * 7919) % 4300) * 36e5),
            downloadCount: (created * 7) % 120,
            extractedText: pdfLines.filter(Boolean).join(" ").replace(/\s+/g, " "),
          },
        });

        const digest = createHash("sha256").update(bytes).digest("hex");
        const key = `colleges/${college.slug}/papers/${paper.id}/${digest.slice(0, 32)}.pdf`;
        const target = path.resolve(STORAGE_ROOT, key);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, bytes);

        await prisma.paperFile.create({
          data: {
            paperId: paper.id,
            storageKey: key,
            originalName: `${subject.code}-${examType.code}-${year}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: bytes.byteLength,
            sha256: digest,
            pageCount: 1,
          },
        });
        await prisma.paperEvent.createMany({
          data: [
            { paperId: paper.id, toState: "SUBMITTED", actorId: uploader.id },
            { paperId: paper.id, fromState: "SUBMITTED", toState: "PENDING_REVIEW", note: "Automated checks passed." },
            { paperId: paper.id, fromState: "PENDING_REVIEW", toState: "APPROVED", actorId: moderator.id },
            { paperId: paper.id, fromState: "APPROVED", toState: "PUBLISHED", actorId: moderator.id },
          ],
        });
        created += 1;
      }
    }
  }

  // A pending submission and a restricted current-year submission for the queue.
  const dbms = await prisma.subject.findFirstOrThrow({
    where: { code: "KCS501", semester: { branch: { program: { collegeId: primary.id } } } },
  });
  const stType = await prisma.examType.findFirstOrThrow({ where: { collegeId: primary.id, code: "ST" } });

  for (const [year, status, reason] of [
    [currentYear - 1, "PENDING_REVIEW", null],
    [currentYear, "RESTRICTED", "This paper may relate to a current or upcoming exam and is awaiting moderator review."],
  ] as const) {
    const session = await prisma.examSession.create({
      data: { subjectId: dbms.id, examTypeId: stType.id, academicYear: year, sessionLabel: `Queue ${year}` },
    });
    const set = await prisma.paperSet.create({ data: { examSessionId: session.id, label: "Set B" } });
    const paper = await prisma.paper.create({
      data: {
        paperSetId: set.id,
        title: dbms.name,
        status,
        restricted: status === "RESTRICTED",
        restrictedReason: reason,
        uploadedById: students[1].id,
      },
    });
    const bytes = buildPdf([`${primary.shortName} — ${dbms.name}`, `ST · ${year} · Set B`, "Seeded submission awaiting review."]);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const key = `colleges/${primary.slug}/papers/${paper.id}/${digest.slice(0, 32)}.pdf`;
    const target = path.resolve(STORAGE_ROOT, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    await prisma.paperFile.create({
      data: {
        paperId: paper.id,
        storageKey: key,
        originalName: `dbms-st-${year}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
        sha256: digest,
        pageCount: 1,
      },
    });
    await prisma.paperEvent.createMany({
      data: [
        { paperId: paper.id, toState: "SUBMITTED", actorId: students[1].id },
        { paperId: paper.id, fromState: "SUBMITTED", toState: status, note: reason ?? "Automated checks passed." },
      ],
    });
  }

  // Demand signals, bookmarks and a report so every screen has data.
  const compiler = await prisma.subject.findFirstOrThrow({
    where: { code: "KCS502", semester: { branch: { program: { collegeId: primary.id } } } },
  });
  await prisma.paperRequest.createMany({
    data: students.slice(0, 5).map((student) => ({
      subjectId: compiler.id,
      examTypeId: stType.id,
      academicYear: currentYear - 1,
      requestedById: student.id,
    })),
  });

  const published = await prisma.paper.findMany({ where: { status: "PUBLISHED" }, take: 6 });
  if (published.length > 0) {
    await prisma.bookmark.createMany({
      data: published.slice(0, 3).map((paper) => ({ userId: students[0].id, paperId: paper.id })),
    });
    await prisma.paperView.createMany({
      data: published.slice(0, 4).map((paper) => ({ userId: students[0].id, paperId: paper.id })),
    });
    await prisma.report.create({
      data: {
        paperId: published[0].id,
        reportedById: students[2].id,
        reason: "WRONG_METADATA",
        details: "Exam type looks wrong — this reads like a Mid-Sem paper.",
      },
    });
  }

  // A sample discussion so the comment thread is not empty on first run.
  if (published.length > 0) {
    const thread = published[0];
    const root = await prisma.comment.create({
      data: {
        paperId: thread.id,
        authorId: students[1].id,
        body: "Does anyone know if Q3 was from the 2022 syllabus or the revised one? The wording looks different from our notes.",
      },
    });
    await prisma.comment.create({
      data: {
        paperId: thread.id,
        authorId: moderator.id,
        parentId: root.id,
        body: "It is from the revised AKTU curriculum. The older paper used the same numbering, so it is easy to mix up — check the unit heading on page 2.",
      },
    });
    await prisma.comment.create({
      data: {
        paperId: thread.id,
        authorId: students[2].id,
        body: "Solved this one in class. Q5(b) needs the two-phase locking proof, not just the definition.",
      },
    });
  }

  // A couple of in-app notifications so the bell has something to show.
  if (published.length > 0) {
    await prisma.inboxMessage.createMany({
      data: [
        {
          userId: students[1].id,
          type: "paper.published",
          title: `${published[0].title} — published`,
          body: "A moderator approved and published your submission. Thanks for contributing.",
          href: `/papers/${published[0].id}`,
        },
        {
          userId: students[1].id,
          type: "comment.reply",
          title: "Neha Verma replied to your comment",
          body: "It is from the revised AKTU curriculum. The older paper used the same numbering…",
          href: `/papers/${published[0].id}#discussion`,
          readAt: new Date(),
        },
      ],
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "seed.completed",
      entityType: "Workspace",
      entityId: "seed",
      after: JSON.stringify({ papers: created }),
    },
  });

  console.log(
    `Seeded ${COLLEGES.length} colleges, ${allSubjects.length} subjects across ${semesterTotal} semesters, and ${created} published papers.`,
  );
  console.log(`Primary college: Raj Kumar Goel Institute of Technology, Ghaziabad (RKGIT), affiliated to AKTU.`,
  );
  console.log(
    `Accounts: admin@papervault.dev / moderator@papervault.dev / student@papervault.dev — password ${PASSWORD}`);
  console.log(`Other moderator: ${otherModerator.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
