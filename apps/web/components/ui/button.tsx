import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ink" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-sun text-[#17130F] border-line press shadow-hard",
  ink: "bg-ink text-paper border-line press shadow-[4px_4px_0_var(--peacock)] hover:!shadow-[5px_5px_0_var(--peacock)]",
  secondary: "bg-card text-ink border-line press shadow-hard",
  danger: "bg-risk-severe-soft text-risk-severe border-line press shadow-hard",
  ghost: "bg-transparent text-ink border-transparent hover:bg-paper-2",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-[13px] rounded-[10px]",
  md: "min-h-11 px-4 text-[15px] rounded-[11px]",
  lg: "min-h-13 px-6 text-[17px] rounded-[12px]",
};

export function buttonStyles({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 border-2 font-bold whitespace-nowrap select-none",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
