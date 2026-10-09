import type { Role } from "./constants";

/**
 * Capability model. Roles map to explicit capabilities so a role can gain or
 * lose a power without hunting for `role === ...` checks. Server-side code
 * checks capabilities against the role re-read from the database on every
 * request (see getSessionUser); nothing here trusts the client.
 *
 * TEACHER deliberately has no staff powers: verification proves teaching
 * affiliation, not moderation trust.
 */
export type Capability =
  | "teacher.badge"
  | "moderation.access"
  | "academics.manage"
  | "admin.access"
  | "users.manage"
  | "teacher_verification.review"
  | "teacher_verification.documents"
  | "tickets.manage"
  | "audit.read";

const CAPABILITIES: Record<Role, readonly Capability[]> = {
  STUDENT: [],
  TEACHER: ["teacher.badge"],
  MODERATOR: ["moderation.access"],
  COLLEGE_ADMIN: ["moderation.access", "academics.manage"],
  PLATFORM_ADMIN: [
    "moderation.access",
    "academics.manage",
    "admin.access",
    "users.manage",
    "teacher_verification.review",
    "teacher_verification.documents",
    "tickets.manage",
    "audit.read",
  ],
};

export function can(role: Role | string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[role as Role] ?? []).includes(capability);
}

export function capabilitiesOf(role: Role): readonly Capability[] {
  return CAPABILITIES[role] ?? [];
}
