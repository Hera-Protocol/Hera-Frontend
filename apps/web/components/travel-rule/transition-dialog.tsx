"use client";

import type { ChainId, TravelRuleStatus } from "@hera/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { ApiError, errorMessage } from "@/lib/api";
import { useTransitionTravelRule } from "@/lib/queries";
import { STATUS_META, TRANSITION_HELP, TRANSITION_LABEL, TX_NOTE_PREFIX } from "./status";

const NOTE_MAX = 1000;

export function txHashError(chain: ChainId, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (chain === "stellar") return /^[0-9a-fA-F]{64}$/.test(v) ? null : "A Stellar transaction hash is 64 hex characters.";
  return /^0x[0-9a-fA-F]{64}$/.test(v) ? null : "An EVM transaction hash is 0x followed by 64 hex characters.";
}

/**
 * Confirm a status change with an optional note. Accepting and settling also
 * take a tx hash; the transition body is `{ to, note }`, so the hash is
 * appended to the note as "Tx hash: …".
 */
export function TransitionDialog({
  transferId,
  chain,
  to,
  initialTxHash = "",
  onClose,
}: {
  transferId: string;
  chain: ChainId;
  to: TravelRuleStatus | null;
  initialTxHash?: string;
  onClose: () => void;
}) {
  const transition = useTransitionTravelRule(transferId);
  const [note, setNote] = useState("");
  const [txHash, setTxHash] = useState(initialTxHash);
  const [error, setError] = useState<string | null>(null);
  const [showTxError, setShowTxError] = useState(false);

  useEffect(() => {
    if (!to) return;
    setNote("");
    setTxHash(initialTxHash);
    setError(null);
    setShowTxError(false);
    transition.reset();
  }, [to]);

  const wantsTx = to === "accepted" || to === "settled";
  const txError = wantsTx ? txHashError(chain, txHash) : null;
  const composed = [note.trim(), wantsTx && txHash.trim() ? `${TX_NOTE_PREFIX}${txHash.trim()}` : ""].filter(Boolean).join("\n");
  const tooLong = composed.length > NOTE_MAX;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to) return;
    if (txError) {
      setShowTxError(true);
      return;
    }
    if (tooLong) return;
    setError(null);
    try {
      await transition.mutateAsync({ to, ...(composed ? { note: composed } : {}) });
      toast.success(`Moved to ${STATUS_META[to].label.toLowerCase()}`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === "invalid_transition") {
        toast.error("That change isn't allowed any more", { description: err.message });
        onClose();
        return;
      }
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog open={to !== null} onClose={onClose} title={to ? TRANSITION_LABEL[to] : ""}>
      {to && (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="text-[15px] text-ink-soft">{TRANSITION_HELP[to]}</p>
          {wantsTx && (
            <Field
              label={to === "settled" ? "Transaction hash" : "Transaction hash (if already broadcast)"}
              hint="Saved in the timeline note."
              error={showTxError && txError ? txError : undefined}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  mono
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  onBlur={() => setShowTxError(true)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  placeholder={chain === "stellar" ? "64 hex characters" : "0x…"}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </Field>
          )}
          <Field
            label="Note (optional)"
            hint={`${composed.length} / ${NOTE_MAX}`}
            error={tooLong ? `Keep the note under ${NOTE_MAX} characters.` : undefined}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                placeholder={to === "rejected" ? "Why it was rejected" : "Anything an auditor should know"}
              />
            )}
          </Field>
          <FormError message={error} />
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant={to === "rejected" ? "danger" : "primary"} loading={transition.isPending} disabled={tooLong}>
              {TRANSITION_LABEL[to]}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
