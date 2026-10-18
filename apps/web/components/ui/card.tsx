import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("brutal", className)} {...props} />;
}

export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b-2 border-line px-5 py-4", className)}>
      <h2 className="text-xl font-extrabold">{title}</h2>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "severe";
}) {
  const severe = tone === "severe";
  return (
    <div className={cn("brutal flex flex-col gap-1.5 p-[18px]", severe && "!bg-risk-severe-soft text-risk-severe")}>
      <span className={cn("text-sm font-semibold", !severe && "text-ink-soft")}>{label}</span>
      <span className="font-display text-[42px] leading-none font-extrabold">{value}</span>
      {hint && <span className={cn("font-mono text-xs", !severe && "text-ink-soft")}>{hint}</span>}
    </div>
  );
}
