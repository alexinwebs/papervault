"use client";

import { useActionState, useState } from "react";
import { Download, Laptop, ShieldCheck, Trash2 } from "lucide-react";
import {
  changePasswordAction,
  eraseAccountAction,
  revokeAllSessionsAction,
  revokeSessionAction,
  updateNotificationPrefsAction,
} from "@/server/actions/auth";
import { idle, type ActionState } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormBanner state={state} />
      <div>
        <label className="pv-label" htmlFor="currentPassword">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="pv-input"
        />
        <FieldError error={state.fieldErrors?.currentPassword} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="pv-label" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="pv-input"
          />
          <FieldError error={state.fieldErrors?.password} />
        </div>
        <div>
          <label className="pv-label" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="pv-input"
          />
          <FieldError error={state.fieldErrors?.confirmPassword} />
        </div>
      </div>
      <p className="font-sans text-[11px] text-ink/55">
        At least 10 characters with a letter and a number. Changing it signs out every other device.
      </p>
      <SubmitButton className="self-start px-4 py-2" pendingLabel="Saving…">
        Change password
      </SubmitButton>
    </form>
  );
}

export function NotificationPrefsForm({
  defaults,
}: {
  defaults: { notifyOnDecision: boolean; notifyOnReply: boolean; notifyDigest: boolean };
}) {
  const [state, action] = useActionState(updateNotificationPrefsAction, idle);
  const rows: Array<[keyof typeof defaults, string, string]> = [
    ["notifyOnDecision", "Decisions on my uploads", "Approved, published, rejected or restricted."],
    ["notifyOnReply", "Replies to my comments", "Someone answers a doubt I posted."],
    ["notifyDigest", "Weekly digest", "A summary instead of individual emails where possible."],
  ];
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormBanner state={state} />
      {rows.map(([name, label, hint]) => (
        <label key={name} htmlFor={name} className="flex items-start gap-3">
          <input
            id={name}
            name={name}
            type="checkbox"
            value="true"
            defaultChecked={defaults[name]}
            className="pv-checkbox mt-0.5"
          />
          <span>
            <span className="block font-mono text-xs">{label}</span>
            <span className="block font-sans text-[11px] text-ink/60">{hint}</span>
          </span>
        </label>
      ))}
      <SubmitButton className="self-start px-4 py-2" pendingLabel="Saving…">
        Save preferences
      </SubmitButton>
    </form>
  );
}

export function SessionList({
  sessions,
  currentSessionId,
}: {
  sessions: Array<{
    id: string;
    userAgent: string | null;
    ip: string | null;
    createdAt: string;
    lastSeenAt: string;
  }>;
  currentSessionId: string;
}) {
  const [state, action] = useActionState(revokeSessionAction, idle);
  const [allState, allAction] = useActionState(
    async (_prev: ActionState) => revokeAllSessionsAction(),
    idle,
  );

  const describe = (ua: string | null) => {
    if (!ua) return "Unknown device";
    if (/android/i.test(ua)) return "Android";
    if (/iphone|ipad/i.test(ua)) return "iPhone or iPad";
    if (/mac os/i.test(ua)) return "Mac";
    if (/windows/i.test(ua)) return "Windows";
    if (/linux/i.test(ua)) return "Linux";
    return "Browser";
  };

  return (
    <div className="flex flex-col gap-3">
      <FormBanner state={state.message ? state : allState} />
      <ul className="flex flex-col gap-2">
        {sessions.map((session) => (
          <li key={session.id} className="pv-row justify-between gap-2">
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-mono text-xs">
                <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {describe(session.userAgent)}
                {session.id === currentSessionId ? (
                  <span className="border-2 border-ink bg-mint px-1 text-[10px] uppercase">
                    this device
                  </span>
                ) : null}
              </span>
              <span className="block truncate font-sans text-[11px] text-ink/55">
                {session.ip ?? "unknown IP"} · last used{" "}
                {new Date(session.lastSeenAt).toLocaleString()}
              </span>
            </span>
            {session.id === currentSessionId ? null : (
              <form action={action}>
                <input type="hidden" name="sessionId" value={session.id} />
                <SubmitButton variant="secondary" className="px-2 py-1 text-[11px]" pendingLabel="…">
                  Sign out
                </SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form action={allAction}>
        <SubmitButton variant="secondary" className="px-3 py-2 text-xs" pendingLabel="…">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Sign out every other device
        </SubmitButton>
      </form>
    </div>
  );
}

/**
 * Right of access and right to erasure, side by side so nobody erases an
 * account without being shown the export link first.
 */
export function DataAndErasurePanel({ isLastAdmin }: { isLastAdmin: boolean }) {
  const [state, action] = useActionState(eraseAccountAction, idle);
  const [armed, setArmed] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs">Download your data</p>
        <p className="mt-1 font-sans text-[11px] text-ink/60">
          Everything we hold about you as one JSON file: profile, uploads, comments, bookmarks,
          reports and sign-in history. Passwords and two-factor secrets are never included.
        </p>
        <a
          href="/api/account/export"
          download
          className="pv-btn-secondary mt-3 inline-flex items-center gap-2 px-3 py-2 text-xs"
          data-testid="export-account"
        >
          <Download className="h-4 w-4" aria-hidden /> Download my data
        </a>
      </div>

      <hr className="border-t-2 border-dashed border-ink/20" />

      <div>
        <p className="font-mono text-xs text-red">Erase this account</p>
        <p className="mt-1 font-sans text-[11px] text-ink/60">
          Your name, email, password, two-factor setup, bookmarks, reports and messages are
          permanently overwritten, and your comments are withdrawn. Papers you contributed stay in
          the archive under an anonymous author, because other students rely on them. This cannot
          be undone.
        </p>

        {isLastAdmin ? (
          <p className="pv-panel-flat mt-3 bg-yellow px-3 py-2 font-mono text-[11px]">
            You are the last platform admin. Promote another admin before erasing this account.
          </p>
        ) : armed ? (
          <form action={action} className="mt-3 flex flex-col gap-3">
            <FormBanner state={state} />
            <div>
              <label className="pv-label" htmlFor="erase-password">
                Your password
              </label>
              <input
                id="erase-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className="pv-input"
              />
              <FieldError error={state.fieldErrors?.currentPassword} />
            </div>
            <div>
              <label className="pv-label" htmlFor="erase-confirm">
                Type ERASE to confirm
              </label>
              <input
                id="erase-confirm"
                name="confirm"
                required
                autoComplete="off"
                placeholder="ERASE"
                className="pv-input"
              />
              <FieldError error={state.fieldErrors?.confirm} />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton
                className="px-3 py-2 text-xs"
                pendingLabel="Erasing…"
                testId="erase-submit"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Erase my account
              </SubmitButton>
              <button
                type="button"
                onClick={() => setArmed(false)}
                className="pv-btn-secondary px-3 py-2 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="pv-btn-secondary mt-3 inline-flex items-center gap-2 px-3 py-2 text-xs"
            data-testid="erase-account"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Erase my account…
          </button>
        )}
      </div>
    </div>
  );
}
