import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { needsSecondFactor } from "@/lib/two-factor-policy";
import { TwoFactorRequired } from "@/components/TwoFactorRequired";

/**
 * Admin screens expose other people's submissions and account data, so they
 * sit behind a second factor (on in production; REQUIRE_ADMIN_2FA overrides).
 * This is the friendly prompt. The binding check is assertSecondFactor in
 * src/server/authz.ts, which every privileged server action calls.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (user && needsSecondFactor(user)) return <TwoFactorRequired area="Admin" />;
  return <>{children}</>;
}
