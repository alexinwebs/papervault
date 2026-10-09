/**
 * Who must have a second factor before using staff powers. Kept free of
 * database imports so both the authorization helpers and the UI can use it.
 */
export const TWO_FACTOR_REQUIRED_ROLES = ["PLATFORM_ADMIN", "COLLEGE_ADMIN"] as const;

export function twoFactorRequired(role: string) {
  return (TWO_FACTOR_REQUIRED_ROLES as readonly string[]).includes(role);
}

/** On in production; REQUIRE_ADMIN_2FA=true|false overrides either way. */
export function adminTwoFactorEnforced() {
  if (process.env.REQUIRE_ADMIN_2FA === "true") return true;
  if (process.env.REQUIRE_ADMIN_2FA === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** True when this user still has to enrol before acting with their role. */
export function needsSecondFactor(user: { role: string; totpConfirmedAt: Date | null }) {
  return adminTwoFactorEnforced() && twoFactorRequired(user.role) && !user.totpConfirmedAt;
}
