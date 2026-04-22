import type { UiCaseStatus } from "@/lib/hera-api";

const statusStyles: Record<UiCaseStatus, { bg: string; text: string; dot?: string }> = {
  CREATED: { bg: "bg-muted", text: "text-muted-foreground" },
  SCANNING: { bg: "bg-secondary/20", text: "text-secondary", dot: "bg-secondary status-pulse" },
  SIGNED: { bg: "bg-primary/20", text: "text-primary" },
  FAILED: { bg: "bg-destructive/20", text: "text-destructive" },
};

export function StatusPill({ status }: { status: UiCaseStatus }) {
  const s = statusStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.08em] font-medium ${s.bg} ${s.text}`}>
      {s.dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
      {status}
    </span>
  );
}
