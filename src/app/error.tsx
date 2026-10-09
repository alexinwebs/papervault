"use client";

import { ErrorState } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <ErrorState
        title="Something went wrong."
        body="The page could not be loaded. Try again — if it keeps failing, the moderators have been notified."
      />
      <button type="button" className="pv-btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
