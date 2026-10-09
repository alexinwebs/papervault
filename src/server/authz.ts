import { forbidden } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import { needsSecondFactor } from "@/lib/two-factor-policy";

/** Staff = anyone with moderation powers. Students and verified teachers are not staff. */
export const isStaff = (role: Role) =>
  role === "MODERATOR" || role === "COLLEGE_ADMIN" || role === "PLATFORM_ADMIN";
export const canModerate = (role: Role) =>
  role === "MODERATOR" || role === "COLLEGE_ADMIN" || role === "PLATFORM_ADMIN";
export const canManageAcademics = (role: Role) =>
  role === "COLLEGE_ADMIN" || role === "PLATFORM_ADMIN";
export const isPlatformAdmin = (role: Role) => role === "PLATFORM_ADMIN";

/**
 * Admin roles must have enrolled a second factor before any staff power works.
 * The admin and moderation layouts show the enrolment prompt; this is the
 * server-side check every privileged action goes through, so skipping the UI
 * (calling a server action directly) does not skip the requirement.
 */
export function assertSecondFactor(user: SessionUser) {
  if (needsSecondFactor(user)) {
    throw forbidden("Set up two-factor authentication in Settings before using admin tools.");
  }
}

export function assertPlatformAdmin(user: SessionUser) {
  if (!isPlatformAdmin(user.role)) throw forbidden("Platform admin access required.");
  assertSecondFactor(user);
}

/**
 * College is the tenant boundary: a moderator or college admin may only act on
 * their own college. Platform admins are global.
 */
export function assertCollegeScope(user: SessionUser, collegeId: string) {
  if (!canModerate(user.role)) throw forbidden("Moderator access required.");
  assertSecondFactor(user);
  if (user.role === "PLATFORM_ADMIN") return;
  if (user.collegeId !== collegeId) {
    throw forbidden("You can only moderate content for your own college.");
  }
}

export function assertCanModerate(user: SessionUser) {
  if (!canModerate(user.role)) throw forbidden("Moderator access required.");
  assertSecondFactor(user);
}

export function assertCanManageAcademics(user: SessionUser, collegeId: string) {
  if (!canManageAcademics(user.role)) throw forbidden("College admin access required.");
  assertCollegeScope(user, collegeId);
}

/** Visibility rule for a single paper. */
export function canViewPaperFile(
  paper: { status: string; restricted: boolean; uploadedById: string; collegeId: string },
  user: SessionUser | null,
) {
  if (paper.status === "PUBLISHED" && !paper.restricted) return true;
  if (!user) return false;
  if (paper.uploadedById === user.id) return true;
  // Staff visibility of unpublished files is a staff power, so it needs 2FA too.
  if (needsSecondFactor(user)) return false;
  if (user.role === "PLATFORM_ADMIN") return true;
  return canModerate(user.role) && user.collegeId === paper.collegeId;
}
