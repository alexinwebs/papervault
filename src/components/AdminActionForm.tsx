"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/server/actions/types";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";

export type ActionField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number";
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  hint?: string;
};

/**
 * One small form for an admin decision: hidden ids, optional inputs, an
 * optional confirm() prompt and an optional typed confirmation word for the
 * irreversible ones. The server action re-checks everything; the prompts only
 * stop a mis-click.
 */
export function AdminActionForm({
  action,
  hidden,
  fields = [],
  submitLabel,
  confirm,
  typedConfirm,
  variant = "secondary",
  testId,
  inline = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  fields?: ActionField[];
  submitLabel: string;
  confirm?: string;
  /** The admin must type this word (e.g. APPROVE) before the button enables. */
  typedConfirm?: string;
  variant?: "primary" | "secondary";
  testId?: string;
  inline?: boolean;
}) {
  const [state, formAction, statePending] = useActionState(action, idle);
  const [typed, setTyped] = useState("");
  const err = state.fieldErrors ?? {};
  const ready = !typedConfirm || typed.trim() === typedConfirm;
  return (
    <form
      action={formAction}
      data-testid={testId}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={inline ? "inline-flex flex-wrap items-center gap-2" : "flex flex-col gap-2"}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => {
        const id = `${testId ?? "f"}-${field.name}`;
        return (
          <div key={field.name}>
            <label htmlFor={id} className="pv-label">
              {field.label}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={id}
                name={field.name}
                className="pv-input min-h-20"
                required={field.required}
                maxLength={field.maxLength ?? 2000}
                placeholder={field.placeholder}
                defaultValue={field.defaultValue}
              />
            ) : field.type === "select" ? (
              <select id={id} name={field.name} className="pv-input" defaultValue={field.defaultValue}>
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={field.name}
                type={field.type === "number" ? "number" : "text"}
                className="pv-input"
                required={field.required}
                maxLength={field.maxLength ?? 300}
                placeholder={field.placeholder}
                defaultValue={field.defaultValue}
              />
            )}
            {field.hint ? <p className="mt-1 font-sans text-[11px] text-ink/60">{field.hint}</p> : null}
            <FieldError error={err[field.name]} />
          </div>
        );
      })}
      {typedConfirm ? (
        <div>
          <label htmlFor={`${testId ?? "f"}-confirm`} className="pv-label">
            Type {typedConfirm} to confirm
          </label>
          <input
            id={`${testId ?? "f"}-confirm`}
            name="confirm"
            className="pv-input"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <FieldError error={err.confirm} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant={variant} className="px-3 py-1.5 text-xs" disabled={!ready}>
          {submitLabel}
        </SubmitButton>
      </div>
      <FormBanner pending={statePending} state={state} />
    </form>
  );
}
