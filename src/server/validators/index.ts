import { z } from "zod";
import {
  ALLOWED_MIME,
  ASSIGNABLE_ROLES,
  COMMENT_REPORT_REASONS,
  EXAM_CLASSIFICATION,
  MAX_UPLOAD_BYTES,
  REPORT_REASONS,
  ROLES,
  TICKET_CATEGORIES,
  TICKET_PRIORITY,
  TICKET_STATUS,
  USER_REPORT_REASONS,
} from "@/lib/constants";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200)
    .regex(/[a-zA-Z]/, "Include at least one letter.")
    .regex(/[0-9]/, "Include at least one number."),
  collegeId: z.string().cuid().optional().or(z.literal("")).transform((v) => v || undefined),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const collegeSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  program: z.string().trim().max(30).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const searchSchema = z.object({
  q: z.string().trim().max(160).default(""),
  page: z.coerce.number().int().min(1).max(200).default(1),
});

const currentYear = new Date().getFullYear();

export const uploadMetadataSchema = z.object({
  collegeId: z.string().min(1, "Select a college."),
  programId: z.string().min(1, "Select a program."),
  branchId: z.string().min(1, "Select a branch."),
  semesterId: z.string().min(1, "Select a semester."),
  subjectId: z.string().min(1, "Select a subject."),
  examTypeId: z.string().min(1, "Select an exam type."),
  academicYear: z.coerce
    .number()
    .int()
    .min(1990, "Year looks too old.")
    .max(currentYear + 1, "Year is in the future."),
  sessionLabel: z.string().trim().max(60).optional().or(z.literal("")),
  setLabel: z.string().trim().max(20).default("Set A"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  examClassification: z.enum(EXAM_CLASSIFICATION, { message: "Tell us whether this exam has already been held." }),
});

export const uploadFileSchema = z.object({
  name: z.string().min(1),
  size: z
    .number()
    .int()
    .positive("File is empty.")
    .max(MAX_UPLOAD_BYTES, `File must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`),
  type: z.enum(ALLOWED_MIME, { message: "Upload a PDF, JPG, or PNG file." }),
});

export const moderationDecisionSchema = z.object({
  paperId: z.string().min(1),
  action: z.enum(["APPROVE", "PUBLISH", "REJECT", "REQUEST_CHANGES", "RESTRICT", "MERGE"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  canonicalPaperId: z.string().min(1).optional().or(z.literal("")),
  verification: z
    .enum(["UNVERIFIED", "COMMUNITY_VERIFIED", "MODERATOR_VERIFIED", "COLLEGE_VERIFIED"])
    .optional(),
  /** Reviewer's confirmation of when the exam was held; required to publish anything not clearly past. */
  examClassification: z.enum(EXAM_CLASSIFICATION).optional().or(z.literal("")),
});

export const reportSchema = z.object({
  paperId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(600).optional().or(z.literal("")),
});

export const paperRequestSchema = z.object({
  subjectId: z.string().min(1),
  examTypeId: z.string().min(1),
  academicYear: z.coerce.number().int().min(1990).max(currentYear),
});

export const bookmarkSchema = z.object({ paperId: z.string().min(1) });

export const resolveReportSchema = z.object({
  reportId: z.string().min(1).max(64),
  status: z.enum(["RESOLVED", "DISMISSED"]).default("RESOLVED"),
  resolution: z.string().trim().max(1000).optional(),
});

export const updateRoleSchema = z.object({
  userId: z.string().min(1).max(64),
  // TEACHER is granted only by approving a teacher verification.
  role: z.enum(ASSIGNABLE_ROLES),
  collegeId: z.string().max(64).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  collegeId: z.string().optional().or(z.literal("")),
});

/* ---------------------------------------------------------------------------
 * Admin: academic taxonomy and content management
 * ------------------------------------------------------------------------- */

const slugField = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only.");

export const collegeInputSchema = z.object({
  name: z.string().trim().min(4, "Enter the full college name.").max(160),
  shortName: z.string().trim().min(2, "Enter a short name.").max(24),
  slug: slugField.optional().or(z.literal("")),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  university: z.string().trim().min(2, "Enter the affiliating university.").max(160),
  about: z.string().trim().max(600).optional().or(z.literal("")),
  accent: z.enum(["blue", "mint", "pink", "lavender", "yellow", "cream"]).default("blue"),
  verified: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
});

export const collegeUpdateSchema = collegeInputSchema.extend({
  collegeId: z.string().min(1),
});

export const programInputSchema = z.object({
  collegeId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the program name.").max(60),
  slug: slugField.optional().or(z.literal("")),
  level: z.enum(["UG", "PG"]).default("UG"),
  semesterCount: z.coerce.number().int().min(1).max(12),
});

export const branchInputSchema = z.object({
  programId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the branch name.").max(120),
  code: z.string().trim().min(1, "Enter a short code.").max(12),
  slug: slugField.optional().or(z.literal("")),
});

export const semesterInputSchema = z.object({
  branchId: z.string().min(1),
  number: z.coerce.number().int().min(1).max(12),
});

export const subjectInputSchema = z.object({
  semesterId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the subject name.").max(140),
  code: z.string().trim().min(2, "Enter the subject code.").max(20),
  slug: slugField.optional().or(z.literal("")),
  curriculumVersionId: z.string().optional().or(z.literal("")),
});

export const examTypeInputSchema = z.object({
  collegeId: z.string().min(1),
  code: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9_]/g, "_")),
  name: z.string().trim().min(1).max(40),
  // Blank means "leave it at the bottom", not NaN.
  sortOrder: z.preprocess(
    (value) => (value === "" || value == null ? 0 : value),
    z.coerce.number().int().min(0).max(99),
  ),
});

/* ----------------------- taxonomy edits and imports ---------------------- */

export const programUpdateSchema = programInputSchema.omit({ collegeId: true }).extend({
  programId: z.string().min(1),
  archived: z.coerce.boolean().optional(),
});

export const branchUpdateSchema = branchInputSchema.omit({ programId: true }).extend({
  branchId: z.string().min(1),
  archived: z.coerce.boolean().optional(),
});

export const subjectUpdateSchema = subjectInputSchema.omit({ semesterId: true }).extend({
  subjectId: z.string().min(1),
  archived: z.coerce.boolean().optional(),
});

export const examTypeUpdateSchema = examTypeInputSchema.omit({ collegeId: true }).extend({
  examTypeId: z.string().min(1),
});

/**
 * Paste-to-import. One subject per line, in any of these shapes:
 *   `KCS501, Database Management Systems, 5`
 *   `5 | KCS501 | Database Management Systems`
 *   `KCS501 Database Management Systems` (semester taken from the form)
 * Tabs, commas and pipes all work as separators, so a spreadsheet column or a
 * copied syllabus table can go straight in.
 */
export const subjectImportSchema = z.object({
  branchId: z.string().min(1),
  // An untouched number input posts "", which `z.coerce.number()` turns into
  // NaN and then rejects. Blank has to mean "not provided".
  defaultSemester: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(12).optional(),
  ),
  rows: z.string().trim().min(3, "Paste at least one subject.").max(40_000),
  replace: z.coerce.boolean().optional(),
});

export const applyCurriculumSchema = z.object({
  branchId: z.string().min(1),
  overwriteNames: z.coerce.boolean().optional(),
});

export const deleteEntitySchema = z.object({
  entity: z.enum([
    "college",
    "program",
    "branch",
    "semester",
    "subject",
    "examType",
    "paper",
    "user",
    "report",
    "examSession",
    "paperSet",
    "curriculumVersion",
  ]),
  id: z.string().min(1),
  force: z.coerce.boolean().optional(),
});

export const paperAdminSchema = z.object({
  paperId: z.string().min(1),
  action: z.enum(["REMOVE", "RESTORE", "RESTRICT", "PUBLISH"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

/* --------------------------- member management --------------------------- */

const memberCore = {
  name: z.string().trim().min(2, "Enter the member's name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(ASSIGNABLE_ROLES),
  collegeId: z.string().optional().or(z.literal("")),
  trustLevel: z
    .enum(["NEW", "VERIFIED_CONTRIBUTOR", "TRUSTED_CONTRIBUTOR"])
    .default("NEW"),
};

export const memberCreateSchema = z.object({
  ...memberCore,
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200)
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
      message: "Include at least one letter and one number.",
    }),
  emailVerified: z.coerce.boolean().optional(),
});

export const memberUpdateSchema = z.object({
  ...memberCore,
  // A verified teacher's edit form posts TEACHER back unchanged; the service
  // refuses any attempt to grant it this way.
  role: z.enum(ROLES),
  userId: z.string().min(1),
});

export const memberActionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum([
    "WARN",
    "RESTRICT",
    "SUSPEND",
    "BAN",
    "UNBAN",
    "VERIFY_EMAIL",
    "RESET_2FA",
    "REVOKE_SESSIONS",
  ]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  /** Suspension length; empty means until lifted. */
  days: z.coerce.number().int().min(1).max(365).optional().or(z.literal("").transform(() => undefined)),
});

export const adminSearchSchema = z.object({
  q: z.string().trim().max(120).optional().or(z.literal("")),
});

/* ------------------------- accounts and security ------------------------- */

const passwordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: "Include at least one letter and one number.",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const notificationPrefsSchema = z.object({
  notifyOnDecision: z.coerce.boolean().optional(),
  notifyOnReply: z.coerce.boolean().optional(),
  notifyDigest: z.coerce.boolean().optional(),
});

export const revokeSessionSchema = z.object({ sessionId: z.string().min(1) });

/* ------------------------------- comments -------------------------------- */

export const commentInputSchema = z.object({
  paperId: z.string().min(1),
  parentId: z.string().optional().or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(2, "Write at least a couple of words.")
    .max(2000, "Keep comments under 2000 characters."),
});

export const commentEditSchema = z.object({
  commentId: z.string().min(1),
  body: z.string().trim().min(2, "Write at least a couple of words.").max(2000),
});

export const commentRemoveSchema = z.object({
  commentId: z.string().min(1),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

export const commentReportSchema = z.object({
  commentId: z.string().min(1),
  reason: z.enum(COMMENT_REPORT_REASONS),
  details: z.string().trim().max(500).optional().or(z.literal("")),
});

export const takedownSchema = z.object({
  paperUrl: z.string().trim().min(8, "Give the address of the page you are reporting.").max(500),
  claimantName: z.string().trim().min(2, "Tell us your name.").max(120),
  claimantEmail: z.string().trim().toLowerCase().email("Enter a valid email address."),
  claimantOrg: z.string().trim().max(160).optional().or(z.literal("")),
  claimantRole: z.enum(["RIGHTS_HOLDER", "AUTHORISED_AGENT", "SUBJECT_OF_DATA"], {
    message: "Choose the capacity you are acting in.",
  }),
  reason: z
    .string()
    .trim()
    .min(30, "Describe the problem in at least 30 characters so a moderator can act on it.")
    .max(4000),
  statementSigned: z.union([z.literal("on"), z.literal("true"), z.boolean()]).optional(),
});

export const takedownResolveSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["UNDER_REVIEW", "ACTIONED", "REJECTED", "REVIEW_REQUESTED", "RESTORED", "CLOSED"]),
  resolution: z.string().trim().min(5, "Record what you decided.").max(2000),
});

export const paperDeleteSchema = z.object({
  paperId: z.string().min(1),
  reason: z.string().trim().min(5, "Say why this paper is being removed.").max(500),
});

export const paperIdSchema = z.object({ paperId: z.string().min(1) });

export const eraseAccountSchema = z.object({
  currentPassword: z.string().min(1, "Enter your password to confirm."),
  // A typed word stops a stray click from destroying an account.
  confirm: z.string().trim(),
});

/* ------------------------- teacher verification -------------------------- */

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const teacherApplicationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name as it appears on your staff ID.").max(120),
  collegeId: z.string().max(64).optional().or(z.literal("")),
  institutionName: z.string().trim().min(2, "Enter your college or institution.").max(200),
  university: optionalText(200),
  department: z.string().trim().min(2, "Enter your department.").max(120),
  designation: z.string().trim().min(2, "Enter your designation, e.g. Assistant Professor.").max(120),
  subjectsTaught: z.string().trim().min(2, "List at least one subject you teach.").max(500),
  institutionalEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address, or leave this empty.")
    .max(200)
    .optional()
    .or(z.literal("")),
  employeeId: optionalText(60),
  verificationNotes: optionalText(2000),
  attest: z.literal("on", { message: "Confirm that the information is accurate." }),
});

export const teacherInfoSchema = z.object({
  requestId: z.string().min(1).max(64),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const teacherDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("START_REVIEW"), requestId: z.string().min(1).max(64) }),
  z.object({
    decision: z.literal("APPROVE"),
    requestId: z.string().min(1).max(64),
    confirm: z.string().trim(),
    note: optionalText(1000),
  }),
  z.object({
    decision: z.literal("REJECT"),
    requestId: z.string().min(1).max(64),
    reason: z.string().trim().min(5, "Give the applicant a short reason.").max(1000),
    internalNote: optionalText(1000),
  }),
  z.object({
    decision: z.literal("REQUEST_INFO"),
    requestId: z.string().min(1).max(64),
    message: z.string().trim().min(5, "Say what the applicant should send.").max(1000),
  }),
  z.object({
    decision: z.literal("NOTE"),
    requestId: z.string().min(1).max(64),
    note: z.string().trim().min(1, "Write a note first.").max(2000),
  }),
  z.object({
    decision: z.literal("REVOKE"),
    requestId: z.string().min(1).max(64),
    reason: z.string().trim().min(5, "Give a reason for revoking.").max(1000),
  }),
  z.object({ decision: z.literal("DELETE_DOCUMENTS"), requestId: z.string().min(1).max(64) }),
]);

/* Support tickets ---------------------------------------------------------- */

const idField = z.string().trim().max(64).optional().or(z.literal(""));
const clientToken = z.string().trim().max(64).optional().or(z.literal(""));

export const ticketCreateSchema = z
  .object({
    category: z.enum(TICKET_CATEGORIES, { message: "Choose what this is about." }),
    subject: z.string().trim().min(4, "Give the ticket a short title.").max(140),
    body: z.string().trim().min(10, "Describe the issue in a sentence or two.").max(5000),
    clientToken,
    relatedPaperId: idField,
    relatedCommentId: idField,
    relatedUserId: idField,
    collegeName: optionalText(160),
    collegeUniversity: optionalText(160),
    collegeCity: optionalText(60),
    collegeState: optionalText(60),
    collegeWebsite: z.string().trim().max(200).url("Enter a full web address, e.g. https://…").optional().or(z.literal("")),
    subjectCollegeId: idField,
    subjectSemesterId: idField,
    subjectName: optionalText(140),
    subjectCode: optionalText(20),
  })
  .superRefine((v, ctx) => {
    const need = (field: keyof typeof v, min: number, message: string) => {
      if (String(v[field] ?? "").trim().length < min) ctx.addIssue({ code: "custom", path: [field], message });
    };
    if (v.category === "ADD_COLLEGE") {
      need("collegeName", 4, "Enter the full college name.");
      need("collegeUniversity", 2, "Enter the affiliating university.");
      need("collegeCity", 2, "Enter the city.");
      need("collegeState", 2, "Enter the state.");
    }
    if (v.category === "ADD_SUBJECT") {
      need("subjectCollegeId", 1, "Choose the college.");
      need("subjectName", 2, "Enter the subject name.");
    }
  });

export const ticketReplySchema = z.object({
  ticketId: z.string().min(1).max(64),
  body: z.string().trim().min(1, "Write a message first.").max(5000),
  clientToken,
});

export const adminTicketReplySchema = ticketReplySchema.extend({
  internal: z.enum(["0", "1"]).default("0"),
  status: z.enum(TICKET_STATUS).optional().or(z.literal("")),
});

export const ticketUpdateSchema = z.object({
  ticketId: z.string().min(1).max(64),
  status: z.enum(TICKET_STATUS).optional().or(z.literal("")),
  priority: z.enum(TICKET_PRIORITY).optional().or(z.literal("")),
  assigneeId: z.string().max(64).optional(),
});

const requestDecision = z.enum(["APPROVE", "REJECT", "NEEDS_INFORMATION"]);

export const collegeRequestDecisionSchema = z.object({
  requestId: z.string().min(1).max(64),
  decision: requestDecision,
  note: optionalText(1000),
  name: optionalText(160),
  shortName: optionalText(24),
  university: optionalText(160),
  city: optionalText(60),
  state: optionalText(60),
});

export const subjectRequestDecisionSchema = z.object({
  requestId: z.string().min(1).max(64),
  decision: requestDecision,
  note: optionalText(1000),
  semesterId: idField,
  name: optionalText(140),
  code: optionalText(20),
});

/* Member reports ----------------------------------------------------------- */

export const userReportSchema = z.object({
  userId: z.string().min(1).max(64),
  reason: z.enum(USER_REPORT_REASONS, { message: "Choose a reason." }),
  details: optionalText(1000),
});

export const userReportResolveSchema = z.object({
  reportId: z.string().min(1).max(64),
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolution: optionalText(500),
});
