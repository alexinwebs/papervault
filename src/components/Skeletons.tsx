import { Skeleton } from "./ui";

/**
 * Loading placeholder for the read-only browse screens.
 *
 * Loading boundaries deliberately do not exist on routes that host mutation
 * forms: a server action that ends in `redirect()` back to its own route
 * re-enters the boundary and, because the action response carries no flight
 * data for that segment, the skeleton never resolves. Those screens render
 * server-side instead.
 */
export function BrowseSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-16 w-full max-w-sm" />
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="h-16 w-full max-w-sm" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
