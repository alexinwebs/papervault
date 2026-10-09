import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readTwoFactorChallenge } from "@/lib/auth";
import { AuthScreen } from "@/components/AuthScreen";
import { TwoFactorChallengeForm } from "./form";

export const metadata: Metadata = { title: "Two-step verification", robots: { index: false } };

export default async function TwoFactorLoginPage() {
  // No challenge cookie means the password step was skipped or has expired.
  const challenge = await readTwoFactorChallenge();
  if (!challenge) redirect("/login");

  return (
    <AuthScreen
      eyebrow="Step 2 of 2"
      title="Enter your code"
      lead="Open your authenticator app and type the six-digit code for PaperVault. You can also use one of your recovery codes."
    >
      <div className="pv-panel px-5 py-5">
        <TwoFactorChallengeForm />
      </div>
    </AuthScreen>
  );
}
