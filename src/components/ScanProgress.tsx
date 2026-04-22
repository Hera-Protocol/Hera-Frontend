import { SCAN_STAGES, type UiScanStage } from "@/lib/hera-api";
import { motion } from "framer-motion";

interface ScanProgressProps {
  currentStage: UiScanStage;
}

export function ScanProgress({ currentStage }: ScanProgressProps) {
  const currentIdx = SCAN_STAGES.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1 w-full overflow-x-auto py-4">
      {SCAN_STAGES.map((stage, i) => {
        const isCompleted = i < currentIdx;
        const isActive = i === currentIdx;
        const isPending = i > currentIdx;

        return (
          <div key={stage} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <motion.div
                className={`w-3 h-3 rounded-full border ${
                  isCompleted
                    ? "bg-primary border-primary"
                    : isActive
                    ? "bg-secondary border-secondary"
                    : "bg-transparent border-muted-foreground/30"
                }`}
                animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <span
                className={`mt-2 text-[10px] uppercase tracking-wider text-center leading-tight ${
                  isCompleted
                    ? "text-primary"
                    : isActive
                    ? "text-secondary"
                    : "text-muted-foreground/50"
                }`}
              >
                {stage.replace(/_/g, " ")}
              </span>
            </div>
            {i < SCAN_STAGES.length - 1 && (
              <div
                className={`h-px flex-1 min-w-4 ${
                  isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
