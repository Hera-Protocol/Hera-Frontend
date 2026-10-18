"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CopyButton } from "./copy-button";

/**
 * Shows a secret exactly once. Escape, the backdrop and the X don't close it:
 * only "I've saved it" does, so nobody loses a key by misclicking.
 */
export function SecretDialog({
  open,
  title,
  secret,
  envName,
  onDone,
  note,
  children,
}: {
  open: boolean;
  title: ReactNode;
  secret: string;
  envName: string;
  onDone: () => void;
  /** Why it can't be shown again. Defaults to the API key wording. */
  note?: ReactNode;
  children?: ReactNode;
}) {
  const preview = `${secret.slice(0, Math.min(secret.length, 14))}…`;
  return (
    <Dialog
      open={open}
      tone="low"
      dismissible={false}
      onClose={onDone}
      title={
        <span className="flex items-center gap-3">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-risk-low text-paper" aria-hidden>
            <Check className="size-5" strokeWidth={3} />
          </span>
          <span className="min-w-0 break-words">{title}</span>
        </span>
      }
      className="max-w-[580px]"
    >
      <div className="flex flex-col gap-3.5">
        <p className="text-[15px] leading-relaxed">
          <strong>Copy it now.</strong> {note ?? "This is the only time Hera will show it. We store a one-way hash, so we can't show it again."}
        </p>
        <div className="flex flex-wrap items-stretch gap-2.5">
          <code className="min-w-0 flex-[1_1_260px] rounded-[11px] border-2 border-line bg-ink px-3.5 py-3 font-mono text-sm break-all text-sun select-all dark:bg-paper">
            {secret}
          </code>
          <CopyButton value={secret} className="min-h-12" />
        </div>
        {children}
        <pre className="overflow-x-auto rounded-[11px] border-2 border-dashed border-line bg-paper p-3 font-mono text-[13px] leading-relaxed">
          export {envName}={preview}
        </pre>
        <div className="flex justify-end">
          <Button variant="ink" onClick={onDone}>
            I&apos;ve saved it
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
