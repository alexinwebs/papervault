import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { verifyEmail } from "@/server/services/account";
import { Panel } from "@/components/ui";
import { AuthScreen } from "@/components/AuthScreen";
import { ResendVerification } from "./resend";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; sent?: string }>;
}) {
  const { token, sent } = await searchParams;
  const user = await getSessionUser();

  let outcome: "ok" | "failed" | null = null;
  if (token) {
    try {
      await verifyEmail(token);
      outcome = "ok";
    } catch {
      outcome = "failed";
    }
  }

  return (
    <AuthScreen eyebrow="Account" title="Confirm your email">
      {outcome === "ok" ? (
        <Panel className="bg-mint px-4 py-4">
          <p className="font-mono text-sm">Your email address is confirmed.</p>
          <p className="mt-2 font-sans text-xs text-ink/70">
            You can now upload papers and join discussions.
          </p>
          <Link href="/" className="pv-btn-primary mt-4 inline-flex px-4 py-2 text-xs">
            Go to the archive
          </Link>
        </Panel>
      ) : outcome === "failed" ? (
        <Panel className="bg-pink px-4 py-4">
          <p className="font-mono text-sm">That link is invalid or has expired.</p>
          <p className="mt-2 font-sans text-xs text-ink/70">
            Links last 24 hours and can be used once. Request a fresh one below.
          </p>
        </Panel>
      ) : sent ? (
        <Panel className="bg-mint px-4 py-4">
          <p className="font-mono text-sm">Check your inbox.</p>
          <p className="mt-2 font-sans text-xs text-ink/70">
            We sent a confirmation link{user ? ` to ${user.email}` : ""}. It is valid for 24 hours.
          </p>
        </Panel>
      ) : null}

      {user && !user.emailVerifiedAt ? (
        <Panel className="px-4 py-4">
          <p className="font-sans text-xs text-ink/70">
            Didn&apos;t get the email? Check spam, then send another.
          </p>
          <div className="mt-3">
            <ResendVerification />
          </div>
        </Panel>
      ) : null}

      {!user ? (
        <p className="font-sans text-xs text-ink/70">
          <Link href="/login" className="pv-link">
            Sign in
          </Link>{" "}
          to request a new confirmation link.
        </p>
      ) : null}
    </AuthScreen>
  );
}
