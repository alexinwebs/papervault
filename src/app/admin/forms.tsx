"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";
import { idle, type ActionState } from "@/server/actions/types";
import { adminPaperAction, deleteEntityAction } from "@/server/actions/admin";
import { usePathname } from "next/navigation";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "checkbox";
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  span?: 1 | 2;
};

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Small declarative form used across the admin screens so every create/update
 * panel gets identical validation, pending and banner behaviour.
 */
export function AdminForm({
  action,
  fields,
  hidden = {},
  submitLabel,
  idPrefix,
  resetOnSuccess = true,
  columns = 2,
}: {
  action: Action;
  fields: FieldSpec[];
  hidden?: Record<string, string>;
  submitLabel: string;
  idPrefix: string;
  resetOnSuccess?: boolean;
  columns?: 1 | 2;
}) {
  const [state, formAction] = useActionState(action, idle);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className={columns === 2 ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
        {fields.map((field) => {
          const id = `${idPrefix}-${field.name}`;
          const error = state.fieldErrors?.[field.name];
          return (
            <div
              key={field.name}
              className={[
                field.span === 2 && columns === 2 ? "sm:col-span-2" : "",
                // Keep checkboxes on the same baseline as the inputs beside them.
                field.type === "checkbox" ? "flex items-end pb-2" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined}
            >
              {field.type === "checkbox" ? (
                <label htmlFor={id} className="flex items-center gap-2 font-mono text-xs">
                  <input
                    id={id}
                    name={field.name}
                    type="checkbox"
                    value="true"
                    defaultChecked={Boolean(field.defaultValue)}
                    className="pv-checkbox"
                  />
                  {field.label}
                </label>
              ) : (
                <>
                  <label
                    htmlFor={id}
                    className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em]"
                  >
                    {field.label}
                  </label>
                  {field.type === "select" ? (
                    <select
                      id={id}
                      name={field.name}
                      defaultValue={String(field.defaultValue ?? "")}
                      required={field.required}
                      className="pv-input"
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={id}
                      name={field.name}
                      rows={3}
                      defaultValue={String(field.defaultValue ?? "")}
                      placeholder={field.placeholder}
                      className="pv-input"
                    />
                  ) : (
                    <input
                      id={id}
                      name={field.name}
                      type={field.type ?? "text"}
                      defaultValue={field.defaultValue ?? ""}
                      placeholder={field.placeholder}
                      required={field.required}
                      className="pv-input"
                    />
                  )}
                </>
              )}
              {field.hint ? (
                <p className="mt-1 font-sans text-[11px] text-ink/55">{field.hint}</p>
              ) : null}
              <FieldError error={error} />
            </div>
          );
        })}
      </div>
      <FormBanner state={state} />
      <div>
        <SubmitButton className="px-4 py-2">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Destructive action with a browser confirm and an explicit "delete anyway"
 * escape hatch for records that still hold papers.
 */
export function DeleteButton({
  entity,
  id,
  label,
  collegeId,
  compact = false,
}: {
  entity: string;
  id: string;
  label: string;
  collegeId?: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(deleteEntityAction, idle);
  const blocked = Boolean(state.message) && !state.ok;
  // The action navigates on success, so it needs to know where we are.
  const pathname = usePathname();

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${label}? This cannot be undone.`)) event.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={pathname} />
      {collegeId ? <input type="hidden" name="collegeId" value={collegeId} /> : null}
      {blocked ? (
        <label className="flex items-center gap-1 font-mono text-[10px]">
          <input type="checkbox" name="force" value="true" className="h-3 w-3 accent-ink" />
          Delete anyway
        </label>
      ) : null}
      <SubmitButton
        variant="secondary"
        pendingLabel="…"
        className={compact ? "px-2 py-1 text-[11px]" : "px-3 py-1 text-xs"}
      >
        Delete
      </SubmitButton>
      {state.message ? (
        <span
          role="status"
          className={`font-sans text-[11px] ${state.ok ? "text-ink/60" : "text-red-700"}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

/** Status override buttons on the admin paper table. */
export function PaperAdminForm({
  paperId,
  action,
  label,
}: {
  paperId: string;
  action: string;
  label: string;
}) {
  const [state, formAction] = useActionState(adminPaperAction, idle);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="paperId" value={paperId} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton variant="secondary" pendingLabel="…" className="px-2 py-1 text-[11px]">
        {label}
      </SubmitButton>
      {state.message && !state.ok ? (
        <span className="ml-1 font-sans text-[10px] text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
