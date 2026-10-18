"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** "Are you sure?" for destructive actions. Cancel gets focus first. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  loading,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  tone?: "danger" | "ink";
}) {
  return (
    <Dialog open={open} onClose={loading ? () => undefined : onClose} title={title} className="max-w-[480px]">
      <div className="flex flex-col gap-5">
        <div className="text-[15px] leading-relaxed">{children}</div>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
