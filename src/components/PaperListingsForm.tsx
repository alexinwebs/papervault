"use client";

import { useActionState } from "react";
import { setPaperListingsAction } from "@/server/actions/moderation";
import { idle } from "@/server/actions/types";
import { FormBanner, SubmitButton } from "./Form";

export type ListingOption = {
  id: string;
  label: string;
  detail: string;
  checked: boolean;
};

/** Moderator control: which other branches this paper is also listed under. */
export function PaperListingsForm({ paperId, options }: { paperId: string; options: ListingOption[] }) {
  const [state, action] = useActionState(setPaperListingsAction, idle);
  if (options.length === 0) {
    return (
      <p className="font-sans text-[11px] leading-relaxed text-ink/70">
        No other branch in this program has a subject with the same code or name.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="listings-form">
      <FormBanner state={state} />
      <input type="hidden" name="paperId" value={paperId} />
      {options.map((option) => (
        <label key={option.id} className="flex items-start gap-2 font-sans text-sm">
          <input
            type="checkbox"
            name="subjectIds"
            value={option.id}
            defaultChecked={option.checked}
            className="mt-1"
          />
          <span>
            <strong>{option.label}</strong>
            <span className="text-ink/60"> — {option.detail}</span>
          </span>
        </label>
      ))}
      <SubmitButton pendingLabel="Saving…" className="self-start">
        Save branches
      </SubmitButton>
    </form>
  );
}
