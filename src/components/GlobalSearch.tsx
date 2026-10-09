"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

/**
 * Global search. It is a plain GET form pointed at /search, so it works
 * before hydration and without JavaScript.
 */
export function GlobalSearch({
  compact = false,
  id = "global-search",
}: {
  compact?: boolean;
  /** Unique per instance: several search boxes can render on one page. */
  id?: string;
}) {
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form role="search" action="/search" method="get" className="flex-1">
      <label htmlFor={id} className="sr-only">
        Search colleges, branches, subjects or papers
      </label>
      <div className="flex items-center gap-2 border-2 border-ink rounded-sm bg-paper px-3 shadow-hard-sm">
        <Search className="h-4 w-4 shrink-0 text-ink/60" aria-hidden />
        <input
          id={id}
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search college, branch, subject, or paper..."
          className={`w-full bg-transparent font-sans outline-none placeholder:text-ink/40 ${
            compact ? "py-2 text-sm" : "py-3 text-sm"
          }`}
          autoComplete="off"
        />
        <button type="submit" className="sr-only">
          Search
        </button>
      </div>
    </form>
  );
}
