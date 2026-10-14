"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/server/actions/auth";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";

export function SettingsForm({
  colleges,
  defaults,
  email,
  role,
}: {
  colleges: { id: string; name: string }[];
  defaults: { name: string; collegeId: string };
  email: string;
  role: string;
}) {
  const [state, action, statePending] = useActionState(updateSettingsAction, idle);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormBanner pending={statePending} state={state} />
      <div>
        <label className="pv-label" htmlFor="name">
          Display name
        </label>
        <input id="name" name="name" className="pv-input" defaultValue={defaults.name} required />
        <FieldError error={state.fieldErrors?.name} />
      </div>
      <div>
        <label className="pv-label" htmlFor="collegeId">
          College
        </label>
        <select id="collegeId" name="collegeId" className="pv-input" defaultValue={defaults.collegeId}>
          <option value="">Not set</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="pv-panel-flat bg-paper px-3 py-3 font-mono text-xs">
        <p>Email: {email}</p>
        <p className="mt-1">Role: {role.replace(/_/g, " ").toLowerCase()}</p>
        <p className="mt-1 text-ink/60">Roles are managed by platform admins.</p>
      </div>
      <SubmitButton className="self-start">Save settings</SubmitButton>
    </form>
  );
}
