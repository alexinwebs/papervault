export const ROLES = ["STUDENT", "TEACHER", "MODERATOR", "COLLEGE_ADMIN", "PLATFORM_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Roles an admin may hand out directly. TEACHER is only granted by approving a verification. */
export const ASSIGNABLE_ROLES = ["STUDENT", "MODERATOR", "COLLEGE_ADMIN", "PLATFORM_ADMIN"] as const;

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: "Student",
  TEACHER: "Verified Teacher",
  MODERATOR: "Moderator",
  COLLEGE_ADMIN: "College admin",
  PLATFORM_ADMIN: "Platform admin",
};

/* Account standing ------------------------------------------------------- */
export const USER_STATUS = ["ACTIVE", "WARNED", "RESTRICTED", "SUSPENDED", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];
export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Active",
  WARNED: "Warned",
  RESTRICTED: "Restricted",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
};

/* Teacher verification ---------------------------------------------------- */
export const TEACHER_VERIFICATION_STATUS = [
  "PENDING",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFORMATION",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REVOKED",
] as const;
export type TeacherVerificationStatus = (typeof TEACHER_VERIFICATION_STATUS)[number];
export const OPEN_TEACHER_STATUSES: TeacherVerificationStatus[] = [
  "PENDING",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFORMATION",
];
export const TEACHER_STATUS_LABEL: Record<TeacherVerificationStatus, string> = {
  PENDING: "Submitted",
  UNDER_REVIEW: "Under review",
  NEEDS_MORE_INFORMATION: "More information needed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVOKED: "Revoked",
};
export const TEACHER_DOC_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const TEACHER_DOC_MAX_BYTES = Number(process.env.TEACHER_DOC_MAX_BYTES ?? 5 * 1024 * 1024);
export const TEACHER_DOC_MAX_FILES = 3;

/* Support tickets --------------------------------------------------------- */
export const TICKET_CATEGORIES = [
  "ADD_COLLEGE",
  "ADD_SUBJECT",
  "REPORT_USER",
  "REPORT_COMMENT",
  "REPORT_PAPER",
  "ACCOUNT",
  "TECHNICAL",
  "COPYRIGHT",
  "GENERAL",
  "OTHER",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  ADD_COLLEGE: "Add new college",
  ADD_SUBJECT: "Add new subject",
  REPORT_USER: "Report a user",
  REPORT_COMMENT: "Report a comment",
  REPORT_PAPER: "Report a paper",
  ACCOUNT: "Account issue",
  TECHNICAL: "Technical problem",
  COPYRIGHT: "Copyright / content issue",
  GENERAL: "General question",
  OTHER: "Other",
};
export const TICKET_STATUS = [
  "OPEN",
  "IN_REVIEW",
  "WAITING_FOR_USER",
  "WAITING_FOR_ADMIN",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUS)[number];
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  WAITING_FOR_USER: "Waiting for you",
  WAITING_FOR_ADMIN: "Waiting for PaperVault",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
export const TICKET_PRIORITY = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITY)[number];
export const TICKET_ATTACHMENT_MAX_BYTES = Number(process.env.TICKET_ATTACHMENT_MAX_BYTES ?? 5 * 1024 * 1024);

export const REQUEST_STATUS = ["REQUESTED", "APPROVED", "REJECTED", "NEEDS_INFORMATION"] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];

/* Academic integrity ------------------------------------------------------ */
export const EXAM_CLASSIFICATION = ["CURRENT", "UPCOMING", "PAST", "RELEASED", "UNKNOWN"] as const;
export type ExamClassification = (typeof EXAM_CLASSIFICATION)[number];
/** Only these may ever be published. */
export const PUBLISHABLE_CLASSIFICATIONS: ExamClassification[] = ["PAST", "RELEASED"];
export const EXAM_CLASSIFICATION_LABEL: Record<ExamClassification, string> = {
  CURRENT: "Current exam (still running)",
  UPCOMING: "Upcoming exam",
  PAST: "Past exam — already held",
  RELEASED: "Officially released by the college",
  UNKNOWN: "Not sure",
};

export const PAPER_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "RESTRICTED",
  "PUBLISHED",
  "REMOVED",
  "MERGED",
] as const;
export type PaperStatus = (typeof PAPER_STATUS)[number];

/** Allowed lifecycle transitions. Enforced server-side in the paper service. */
export const PAPER_TRANSITIONS: Record<PaperStatus, PaperStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["PENDING_REVIEW", "RESTRICTED", "REJECTED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "CHANGES_REQUESTED", "RESTRICTED", "MERGED"],
  CHANGES_REQUESTED: ["SUBMITTED", "REMOVED"],
  APPROVED: ["PUBLISHED", "RESTRICTED", "REMOVED"],
  REJECTED: ["PENDING_REVIEW", "REMOVED"],
  RESTRICTED: ["PENDING_REVIEW", "REMOVED"],
  PUBLISHED: ["RESTRICTED", "REMOVED", "MERGED"],
  REMOVED: [],
  MERGED: [],
};

export const VERIFICATION = [
  "UNVERIFIED",
  "COMMUNITY_VERIFIED",
  "MODERATOR_VERIFIED",
  "COLLEGE_VERIFIED",
] as const;
export type Verification = (typeof VERIFICATION)[number];

export const VERIFICATION_LABEL: Record<Verification, string> = {
  UNVERIFIED: "Unverified",
  COMMUNITY_VERIFIED: "Community verified",
  MODERATOR_VERIFIED: "Verified",
  COLLEGE_VERIFIED: "College verified",
};

export const REPORT_REASONS = [
  "CURRENT_OR_UPCOMING_EXAM",
  "WRONG_METADATA",
  "DUPLICATE",
  "UNAUTHORIZED_MATERIAL",
  "COPYRIGHT_CONCERN",
  "PERSONAL_INFORMATION",
  "INAPPROPRIATE",
  "OTHER",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  CURRENT_OR_UPCOMING_EXAM: "Current or upcoming exam material",
  WRONG_METADATA: "Wrong metadata",
  DUPLICATE: "Duplicate paper",
  UNAUTHORIZED_MATERIAL: "Unauthorized or confidential material",
  COPYRIGHT_CONCERN: "Copyright / rights issue",
  PERSONAL_INFORMATION: "Contains personal information",
  INAPPROPRIATE: "Inappropriate content",
  OTHER: "Something else",
};

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

/** Papers from the current or next academic year never auto-publish. */
export const CURRENT_EXAM_GUARD_YEARS = 0;

/** Reasons for reporting a discussion comment. */
export const COMMENT_REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "ABUSIVE",
  "INAPPROPRIATE",
  "HATE",
  "MISLEADING",
  "REPEATED_VIOLATION",
  "EXAM_MALPRACTICE",
  "OFF_TOPIC",
  "OTHER",
] as const;
export type CommentReportReason = (typeof COMMENT_REPORT_REASONS)[number];
export const COMMENT_REPORT_REASON_LABEL: Record<CommentReportReason, string> = {
  SPAM: "Spam or advertising",
  HARASSMENT: "Harassment",
  ABUSIVE: "Abusive language",
  INAPPROPRIATE: "Inappropriate content",
  HATE: "Hate or targeted abuse",
  MISLEADING: "Misleading information",
  REPEATED_VIOLATION: "Repeated violation",
  EXAM_MALPRACTICE: "Encourages exam malpractice",
  OFF_TOPIC: "Off topic",
  OTHER: "Something else",
};

/** Reasons for reporting a member. */
export const USER_REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "ABUSIVE",
  "INAPPROPRIATE",
  "HATE",
  "MISLEADING",
  "REPEATED_VIOLATION",
  "OTHER",
] as const;
export type UserReportReason = (typeof USER_REPORT_REASONS)[number];
export const USER_REPORT_REASON_LABEL: Record<UserReportReason, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  ABUSIVE: "Abuse",
  INAPPROPRIATE: "Inappropriate content",
  HATE: "Hate or targeted abuse",
  MISLEADING: "Misleading information",
  REPEATED_VIOLATION: "Repeated violation",
  OTHER: "Something else",
};
