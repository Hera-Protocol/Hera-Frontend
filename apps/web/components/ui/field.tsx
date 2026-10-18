import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full border-2 border-line bg-card text-ink rounded-[11px] px-3.5 py-3 text-base placeholder:text-ink-soft/70 " +
  "focus-visible:outline-3 focus-visible:outline-iris focus-visible:outline-offset-1 aria-invalid:border-risk-severe aria-invalid:bg-risk-severe-soft/40";

/**
 * Label + control + hint/error, wired for screen readers. Pass a render prop
 * to receive the ids the control needs.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <span id={errorId} className="text-[13px] font-medium text-risk-severe">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="text-[13px] text-ink-soft">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input"> & { mono?: boolean }>(function Input(
  { className, mono, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, mono && "font-mono text-sm", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "resize-y", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(control, "pr-8 font-medium", className)} {...props} />;
});

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-[12px] border-2 border-line bg-risk-severe-soft px-3 py-2.5 text-sm">
      <strong className="text-risk-severe">{message}</strong>
    </div>
  );
}

/** Visually hidden but available to screen readers. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
