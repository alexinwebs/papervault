import Link from "next/link";
import { teacherVerificationEnabled } from "@/lib/features";
import type { Metadata } from "next";
import { PageHeading, Panel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./form";
import {
  ChangePasswordForm,
  DataAndErasurePanel,
  NotificationPrefsForm,
  SessionList,
} from "./security";
import { ResendVerification } from "../verify-email/resend";
import { listSessions } from "@/server/services/account";
import { TwoFactorPanel } from "@/components/TwoFactorPanel";
import { recoveryCodesRemaining, twoFactorRequired } from "@/server/services/two-factor";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading eyebrow="Settings" title="Sign in to manage your account" />
        <Link href="/login?next=/settings" className="pv-btn-primary self-start">
          Sign in
        </Link>
      </div>
    );
  }
  const [colleges, sessions, prefs] = await Promise.all([
    prisma.college.findMany({
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    listSessions(user.id),
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        notifyOnDecision: true,
        notifyOnReply: true,
        notifyDigest: true,
        totpConfirmedAt: true,
      },
    }),
  ]);
  const recoveryRemaining = prefs.totpConfirmedAt ? await recoveryCodesRemaining(user.id) : 0;
  // Erasing the only platform admin would leave nobody able to moderate.
  const isLastAdmin =
    user.role === "PLATFORM_ADMIN" &&
    (await prisma.user.count({
      where: { role: "PLATFORM_ADMIN", anonymizedAt: null, id: { not: user.id } },
    })) === 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeading eyebrow="Settings" title="Your account" />

      {user.emailVerifiedAt ? null : (
        <Panel className="bg-yellow px-5 py-4">
          <p className="font-mono text-sm">Confirm your email address</p>
          <p className="mt-1 font-sans text-xs text-ink/70">
            Uploading, commenting and reporting are locked until {user.email} is confirmed.
          </p>
          <div className="mt-3">
            <ResendVerification />
          </div>
        </Panel>
      )}

      <Panel className="px-5 py-5">
        <h2 className="pv-section-title mb-3">Profile</h2>
        <SettingsForm
          colleges={colleges}
          defaults={{ name: user.name, collegeId: user.collegeId ?? "" }}
          email={user.email}
          role={user.role}
        />
      </Panel>

      {user.status !== "ACTIVE" ? (
        <Panel className="bg-pink px-5 py-4" testId="account-standing">
          <p className="font-mono text-sm">
            Account {user.status === "WARNED" ? "warning" : "restricted"}
          </p>
          <p className="mt-1 font-sans text-xs text-ink/70">
            {user.status === "WARNED"
              ? "A moderator has warned this account. Please review the community guidelines."
              : "Your account is read-only: uploading, commenting and reporting are paused. You can still open a support ticket to appeal."}{" "}
            <Link href="/legal/guidelines" className="pv-link">Community guidelines</Link>
          </p>
        </Panel>
      ) : null}

      <Panel className="px-5 py-5">
        <h2 className="pv-section-title mb-1">Teacher verification &amp; support</h2>
        <p className="font-sans text-xs text-ink/70">
          {user.role === "TEACHER" ? (
            <>You are a Verified Teacher. </>
          ) : user.role === "STUDENT" && teacherVerificationEnabled() ? (
            <>
              Teach at a college?{" "}
              <Link href="/teacher-verification" className="pv-link">Apply for the Verified Teacher badge</Link>.{" "}
            </>
          ) : null}
          Need help or a new college or subject? <Link href="/support" className="pv-link">Open a ticket</Link> or see{" "}
          <Link href="/my-tickets" className="pv-link">My tickets</Link>.
        </p>
      </Panel>

      <Panel className="px-5 py-5">
        <h2 className="pv-section-title mb-3">Password</h2>
        <ChangePasswordForm />
      </Panel>

      <Panel className="px-5 py-5">
        <h2 className="pv-section-title mb-1">Two-factor authentication</h2>
        <p className="mb-3 font-sans text-[11px] text-ink/60">
          A code from your phone in addition to your password. Required for admin roles.
        </p>
        <TwoFactorPanel
          enabled={Boolean(prefs.totpConfirmedAt)}
          required={twoFactorRequired(user.role)}
          recoveryRemaining={recoveryRemaining}
        />
      </Panel>

      <Panel className="px-5 py-5">
        <h2 className="pv-section-title mb-3">Email notifications</h2>
        <NotificationPrefsForm defaults={prefs} />
      </Panel>

      <Panel className="px-5 py-5">
        <h2 className="pv-section-title mb-1">Signed-in devices</h2>
        <p className="mb-3 font-sans text-[11px] text-ink/60">
          Each sign-in creates a session you can revoke here. Revoking takes effect immediately.
        </p>
        <SessionList
          currentSessionId={user.sessionId}
          sessions={sessions.map((session) => ({
            id: session.id,
            userAgent: session.userAgent,
            ip: session.ip,
            createdAt: session.createdAt.toISOString(),
            lastSeenAt: session.lastSeenAt.toISOString(),
          }))}
        />
      </Panel>

      <Panel className="px-5 py-5">
        <h2 className="pv-section-title mb-1">Your data</h2>
        <p className="mb-3 font-sans text-[11px] text-ink/60">
          Export or erase the personal data we hold, as described in the{" "}
          <Link href="/legal/privacy" className="pv-link">
            privacy policy
          </Link>
          .
        </p>
        <DataAndErasurePanel isLastAdmin={isLastAdmin} />
      </Panel>
    </div>
  );
}
