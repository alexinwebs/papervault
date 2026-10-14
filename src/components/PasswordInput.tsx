"use client";

import { useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cx } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "type">;

/** Values remain in the input: revealing a password never submits or copies it. */
export function PasswordInput({ className, disabled, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input {...props} ref={input} type={visible ? "text" : "password"} disabled={disabled}
        spellCheck={false} autoCapitalize="none" autoCorrect="off"
        className={cx("pv-input pr-12", className)} />
      <button type="button" disabled={disabled} aria-controls={props.id} aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-sm text-ink hover:bg-blue-soft/50 disabled:opacity-50"
        onClick={() => {
          const node = input.current;
          const start = node?.selectionStart;
          const end = node?.selectionEnd;
          setVisible((current) => !current);
          // Keep the user's editing position when using the eye button.
          requestAnimationFrame(() => {
            node?.focus({ preventScroll: true });
            if (start != null && end != null) node?.setSelectionRange(start, end);
          });
        }}>
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
