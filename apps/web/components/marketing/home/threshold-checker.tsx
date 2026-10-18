"use client";

import { checkTravelRule, getJurisdiction, JURISDICTIONS } from "@hera/core";
import { BadgeCheck, CircleCheck, KeyRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";
import { ToggleGroup } from "../toggle-group";

const thresholdText = (code: string) => {
  const j = getJurisdiction(code);
  return j.threshold === 0 ? "Every transfer" : `${j.currency} ${j.threshold.toLocaleString("en-US")}`;
};

/**
 * "Does the Travel Rule apply?" Runs the same `checkTravelRule` the API uses,
 * in the browser, and highlights the jurisdiction in the defaults table.
 */
export function ThresholdChecker() {
  const toggleLabelId = useId();
  const [jurisdiction, setJurisdiction] = useState("FATF");
  const [amount, setAmount] = useState("2,500");
  const [wallet, setWallet] = useState<"hosted" | "unhosted">("hosted");

  const amountUsd = Number(amount.replace(/[,\s$]/g, ""));
  const amountValid = amount.trim() !== "" && Number.isFinite(amountUsd) && amountUsd >= 0;
  const check = useMemo(
    () => (amountValid ? checkTravelRule({ amountUsd, jurisdiction, counterpartyHosted: wallet === "hosted" }) : null),
    [amountUsd, amountValid, jurisdiction, wallet],
  );
  const j = getJurisdiction(jurisdiction);

  return (
    <div className="flex flex-col gap-6">
      <div className="brutal flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-2xl font-extrabold">Does the Travel Rule apply?</h3>
          <p className="text-[15px] text-ink-soft">Pick a jurisdiction and an amount. This runs the same check the API does.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jurisdiction">
            {({ id }) => (
              <Select id={id} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                {JURISDICTIONS.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Amount (USD)" error={amountValid ? undefined : "Enter an amount in US dollars"}>
            {({ id, describedBy, invalid }) => (
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-ink-soft" aria-hidden>
                  $
                </span>
                <Input
                  id={id}
                  mono
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  className="pl-7"
                />
              </div>
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={toggleLabelId} className="text-sm font-semibold">
            Counterparty wallet
          </span>
          <ToggleGroup
            labelId={toggleLabelId}
            value={wallet}
            onChange={setWallet}
            options={[
              { value: "hosted", label: "VASP-hosted" },
              { value: "unhosted", label: "Self-hosted" },
            ]}
          />
        </div>

        <div aria-live="polite" className="min-h-[132px]">
          <AnimatePresence mode="wait" initial={false}>
            {check ? (
              <motion.div
                key={`${jurisdiction}-${check.required}-${check.unhostedProofRequired}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={cn("flex flex-col gap-3 rounded-[12px] border-2 border-line p-4", check.required ? "bg-iris-soft" : "bg-peacock-soft")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-lg font-extrabold">
                    {check.required ? <BadgeCheck className="size-5" aria-hidden /> : <CircleCheck className="size-5" aria-hidden />}
                    {check.required ? "Travel Rule applies" : "Below the threshold"}
                  </span>
                  {check.unhostedProofRequired && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-line bg-blush-soft px-2.5 py-0.5 text-[13px] font-bold">
                      <KeyRound className="size-3.5" aria-hidden /> Proof of wallet control
                    </span>
                  )}
                </div>
                <p className="text-[15px] leading-relaxed">{check.explanation}</p>
                <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-ink-soft">
                  <span>Threshold ≈ {check.thresholdUsd === 0 ? "USD 0 (always)" : formatUsd(check.thresholdUsd)}</span>
                  <span>{j.reference}</span>
                </p>
              </motion.div>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 text-[15px] text-ink-soft">
                Enter an amount to see the answer.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <p className="text-[13px] text-ink-soft">
          Amounts in other currencies are converted at a rough fixed rate here. Thresholds must be confirmed with counsel for your program.
        </p>
      </div>

      <div className="brutal relative overflow-hidden">
        <table className="w-full border-collapse text-[15px]">
          <caption className="border-b-2 border-line px-[18px] py-3.5 text-left font-mono text-xs tracking-[0.1em] text-ink-soft uppercase">
            Default thresholds · configurable per org
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Jurisdiction</th>
              <th scope="col">Data required from</th>
            </tr>
          </thead>
          <tbody>
            {JURISDICTIONS.map((x) => {
              const on = x.code === jurisdiction;
              return (
                <tr
                  key={x.code}
                  aria-current={on || undefined}
                  className={cn("border-b border-dashed border-line/25 transition-colors last:border-0", on && "bg-sun/25")}
                >
                  <th scope="row" className="px-[18px] py-[11px] text-left font-semibold">
                    <button type="button" onClick={() => setJurisdiction(x.code)} className="text-left hover:text-iris">
                      {x.name}
                    </button>
                  </th>
                  <td className="px-[18px] py-[11px] text-right font-mono">{thresholdText(x.code)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
