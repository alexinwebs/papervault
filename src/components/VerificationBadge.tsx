import { BadgeCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { VERIFICATION_LABEL, type Verification } from "@/lib/constants";
import { cx } from "@/lib/utils";

export function VerificationBadge({
  verification,
  restricted,
  className,
}: {
  verification: string;
  restricted?: boolean;
  className?: string;
}) {
  if (restricted) {
    return (
      <span className={cx("pv-chip bg-pink", className)}>
        <ShieldAlert className="h-3 w-3" aria-hidden /> Restricted
      </span>
    );
  }
  const label = VERIFICATION_LABEL[verification as Verification] ?? "Unverified";
  if (verification === "UNVERIFIED") {
    return (
      <span className={cx("pv-chip bg-cream text-ink/70", className)}>
        <ShieldQuestion className="h-3 w-3" aria-hidden /> {label}
      </span>
    );
  }
  return (
    <span className={cx("pv-chip bg-mint", className)}>
      <BadgeCheck className="h-3 w-3" aria-hidden /> {label}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const tone =
    status === "PUBLISHED"
      ? "bg-mint"
      : status === "RESTRICTED" || status === "REJECTED"
        ? "bg-pink"
        : status === "APPROVED"
          ? "bg-blue-light"
          : "bg-yellow";
  return (
    <span data-testid="status-chip" className={cx("pv-chip", tone)}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
