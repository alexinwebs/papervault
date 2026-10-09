"use client";

import { useActionState } from "react";
import { updateRoleAction } from "@/server/actions/moderation";
import { idle } from "@/server/actions/types";
import { ROLES } from "@/lib/constants";

export function RoleForm({
  userId,
  role,
  collegeId,
  colleges,
}: {
  userId: string;
  role: string;
  collegeId: string;
  colleges: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateRoleAction, idle);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role
      </label>
      <select id={`role-${userId}`} name="role" defaultValue={role} className="pv-input w-auto py-1 text-xs">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace(/_/g, " ").toLowerCase()}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`college-${userId}`}>
        College
      </label>
      <select
        id={`college-${userId}`}
        name="collegeId"
        defaultValue={collegeId}
        className="pv-input w-auto py-1 text-xs"
      >
        <option value="">No college</option>
        {colleges.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className="pv-btn-secondary px-2 py-1">
        Save
      </button>
      {state.message ? <span className="font-sans text-[11px]">{state.message}</span> : null}
    </form>
  );
}
