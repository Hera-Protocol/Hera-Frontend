import { cn } from "@/lib/cn";

/** Exact trace of the Hera H mark (apps/web/public/hera-mark.svg). */
const H_PATH =
  "M0 0H44.6V7.7H0zM55.3 0H100V7.7H55.3zM0 0H7.8V100H0zM0 92.3H44.6V100H0zM55.3 92.3H100V100H55.3zM92.2 0H100V100H92.2zM36.8 0H44.6V44.6H36.8zM36.8 36.8H63V44.6H36.8zM55.3 0H63V44.6H55.3zM55.3 18.4H81.5V26.1H55.3zM73.7 18.4H81.5V81.5H73.7zM36.8 55.4H63V63.1H36.8zM36.8 55.4H44.6V100H36.8zM55.3 55.4H63V100H55.3zM18.4 18.4H26.1V81.5H18.4zM18.4 73.8H44.6V81.5H18.4z";

export function HMark({ size = 30, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path fill="currentColor" d={H_PATH} />
    </svg>
  );
}

export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <HMark size={size} />
      <span className="font-display font-extrabold tracking-[-0.03em]" style={{ fontSize: size * 0.8 }}>
        hera
      </span>
    </span>
  );
}
