"use client";

import { SuccessPopup } from "@/components/SuccessPopup";
import { useActionState } from "react";
import { fileTakedownAction } from "@/server/actions/takedowns";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";

const ROLES = [
  { value: "RIGHTS_HOLDER", label: "I own the rights in this material" },
  { value: "AUTHORISED_AGENT", label: "I am authorised to act for the rights holder" },
  { value: "SUBJECT_OF_DATA", label: "The material exposes my personal information" },
];

export function TakedownForm() {
  const [state, action, statePending] = useActionState(fileTakedownAction, idle);

  if (state.ok) {
    return (
      <SuccessPopup message={state.message} />
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <FormBanner pending={statePending} state={state} />
      <div>
        <label className="pv-label" htmlFor="paperUrl">
          Address of the page
        </label>
        <input
          id="paperUrl"
          name="paperUrl"
          required
          placeholder="https://…/papers/…"
          className="pv-input"
        />
        <FieldError error={state.fieldErrors?.paperUrl} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="pv-label" htmlFor="claimantName">
            Your full name
          </label>
          <input id="claimantName" name="claimantName" required className="pv-input" />
          <FieldError error={state.fieldErrors?.claimantName} />
        </div>
        <div>
          <label className="pv-label" htmlFor="claimantEmail">
            Your email address
          </label>
          <input
            id="claimantEmail"
            name="claimantEmail"
            type="email"
            required
            className="pv-input"
          />
          <FieldError error={state.fieldErrors?.claimantEmail} />
        </div>
      </div>
      <div>
        <label className="pv-label" htmlFor="claimantOrg">
          College or organisation (optional)
        </label>
        <input id="claimantOrg" name="claimantOrg" className="pv-input" />
      </div>
      <div>
        <label className="pv-label" htmlFor="claimantRole">
          You are acting as
        </label>
        <select id="claimantRole" name="claimantRole" required defaultValue="" className="pv-input">
          <option value="" disabled>
            Select a capacity
          </option>
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <FieldError error={state.fieldErrors?.claimantRole} />
      </div>
      <div>
        <label className="pv-label" htmlFor="reason">
          What is wrong with this material?
        </label>
        <textarea id="reason" name="reason" rows={5} required className="pv-input" />
        <FieldError error={state.fieldErrors?.reason} />
      </div>
      <label className="flex items-start gap-2 font-sans text-xs text-ink/80">
        <input
          type="checkbox"
          name="statementSigned"
          required
          className="pv-checkbox mt-[2px]"
        />
        <span>
          I state in good faith that this use is not authorised by the rights holder or the law,
          and that the information I have given is accurate. I understand that knowingly filing a
          false notice may have legal consequences.
        </span>
      </label>
      <SubmitButton className="self-start px-4 py-2" pendingLabel="Sending…">
        Send the notice
      </SubmitButton>
    </form>
  );
}
