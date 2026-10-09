import Link from "next/link";
import { ErrorState } from "./ui";

/** Rendered when a signed-in user lacks the role for a staff route. */
export function Forbidden({ area }: { area: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <ErrorState
        title={`${area} is restricted`}
        body="Your account does not have access to this area. Moderator or admin permissions are granted by a platform admin."
      />
      <Link href="/" className="pv-btn-primary">
        Back to home
      </Link>
    </div>
  );
}
