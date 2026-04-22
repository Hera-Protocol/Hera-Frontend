import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";

export function BackendNotice({
  title,
  description,
  actionLabel = "Open Settings",
  actionPath = "/dashboard/settings",
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
}) {
  return (
    <div className="border border-primary/30 bg-primary/5 p-6 rounded-[6px]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-mono font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <Link
            to={actionPath}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-primary hover:text-primary/80"
          >
            {actionLabel}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
