"use client";

import { useActionState } from "react";
import { registerAction } from "@/server/actions/auth";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";

export function RegisterForm({ colleges }: { colleges: { id: string; name: string }[] }) {
  const [state, action] = useActionState(registerAction, idle);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormBanner state={state} />
      <div>
        <label className="pv-label" htmlFor="name">
          Name
        </label>
        <input id="name" name="name" className="pv-input" required autoComplete="name" />
        <FieldError error={state.fieldErrors?.name} />
      </div>
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
        <input
          id="password"
          name="password"
          type="password"
          className="pv-input"
          required
          autoComplete="new-password"
          minLength={10}
        />
        <FieldError error={state.fieldErrors?.password} />
        <p className="mt-1 font-sans text-[11px] text-ink/60">
          At least 10 characters, with a letter and a number.
        </p>
      </div>
      <div>
        <label className="pv-label" htmlFor="collegeId">
          Your college <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <select id="collegeId" name="collegeId" className="pv-input" defaultValue="">
          <option value="">Choose later</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
    </form>
  );
}
