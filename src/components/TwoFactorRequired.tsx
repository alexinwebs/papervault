import Link from "next/link";
import { Panel } from "@/components/ui";

/** Shown in place of admin and moderation screens until 2FA is enrolled. */
export function TwoFactorRequired({ area }: { area: string }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Panel className="flex flex-col gap-3 bg-yellow px-5 py-5">
        <p className="pv-eyebrow">{area}</p>
        <h1 className="pv-h2">Set up two-factor authentication first</h1>
        <p className="font-sans text-sm text-ink/80">
          Your role can read other students&rsquo; submissions, change roles and remove papers.
          Before those screens open, add an authenticator app to your account. It takes about a
          minute.
        </p>
        <Link href="/settings" className="pv-btn-primary self-start px-4 py-2">
          Go to Settings
        </Link>
      </Panel>
    </div>
  );
}
