"use client";

import { PasswordInput } from "@/components/PasswordInput";
import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction } from "@/server/actions/auth";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";
import { AuthScreen } from "@/components/AuthScreen";

function LoginForm() {
  const [state, action, statePending] = useActionState(loginAction, idle);
  const next = useSearchParams().get("next") ?? "/";

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormBanner pending={statePending} state={state} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="pv-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" className="pv-input" required autoComplete="email" />
        <FieldError error={state.fieldErrors?.email} />
      </div>
      <div>
        <label className="pv-label" htmlFor="password">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          className="pv-input"
          required
          autoComplete="current-password"
        />
        <FieldError error={state.fieldErrors?.password} />
      </div>
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="font-sans text-xs text-ink/70">
        <Link href="/forgot-password" className="pv-link">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthScreen
      eyebrow="Welcome back"
      title="Sign in to PaperVault"
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="pv-link">
            Create a contributor account
          </Link>
          .
        </>
      }
    >
      <div className="pv-panel px-5 py-5">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
      {/* Seed credentials are a local convenience only — never ship them to users. */}
      {process.env.NODE_ENV === "development" ? (
        <div className="pv-panel-flat bg-yellow px-4 py-3 font-sans text-[11px] leading-relaxed">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Development seed data</span>
          <p className="mt-1">
            student@papervault.dev · moderator@papervault.dev · admin@papervault.dev — password{" "}
            <code className="font-mono">papervault123</code>
          </p>
        </div>
      ) : null}
    </AuthScreen>
  );
}
