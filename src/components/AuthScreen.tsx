import type { ReactNode } from "react";
import { LogoWordmark } from "./Brand";

/**
 * Shared frame for the signed-out account flows so login, registration,
 * password reset and verification all present the brand identically.
 */
export function AuthScreen({
  eyebrow,
  title,
  lead,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-2 sm:py-6">
      <div className="flex justify-center">
        <LogoWordmark width={260} priority className="max-w-full" />
      </div>
      <div>
        {eyebrow ? <p className="pv-eyebrow">{eyebrow}</p> : null}
        <h1 className="pv-h2 mt-1">{title}</h1>
        {lead ? <p className="mt-2 font-sans text-sm text-ink/75">{lead}</p> : null}
      </div>
      {children}
      {footer ? <div className="font-sans text-xs text-ink/70">{footer}</div> : null}
    </div>
  );
}
