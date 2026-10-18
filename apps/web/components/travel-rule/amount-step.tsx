"use client";

import { getJurisdiction, JURISDICTIONS } from "@hera/core";
import { type RefObject, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { SelectField, TextField } from "./fields";
import { cleanNumber, type TravelRuleFormValues } from "./form";

const USD_STABLES = new Set(["USDC", "USDT", "PYUSD", "USDP"]);
const ASSET_SUGGESTIONS = ["USDC", "EURC", "USDT", "XLM", "ETH"];

function thresholdText(code: string) {
  const j = getJurisdiction(code);
  return j.threshold === 0 ? "Every transfer" : `${j.currency} ${j.threshold.toLocaleString("en-US")} and above`;
}

/**
 * Chain, asset, amount, USD value and rulebook. For USD stablecoins the USD
 * value follows the amount 1:1 until the user types their own.
 */
export function AmountStep({ usdTouched }: { usdTouched: RefObject<boolean> }) {
  const { control, setValue } = useFormContext<TravelRuleFormValues>();
  const [asset, amount, jurisdiction] = useWatch({ control, name: ["asset", "amount", "jurisdiction"] });
  const stable = USD_STABLES.has(asset.trim().toUpperCase());

  useEffect(() => {
    if (stable && !usdTouched.current) setValue("amountUsd", cleanNumber(amount), { shouldDirty: true });
  }, [stable, amount, setValue, usdTouched]);


  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField name="chain" label="Chain">
          <option value="stellar">Stellar</option>
          <option value="evm:1">Ethereum</option>
        </SelectField>
        <TextField name="asset" label="Asset" list="tr-assets" mono maxLength={12} autoComplete="off" inputClassName="uppercase" />
        <datalist id="tr-assets">
          {ASSET_SUGGESTIONS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <TextField name="amount" label="Amount" inputMode="decimal" placeholder="0.00" mono autoComplete="off" inputClassName="text-base" />
        <TextField
          name="amountUsd"
          label="Value in USD"
          inputMode="decimal"
          placeholder="0"
          mono
          autoComplete="off"
          inputClassName="bg-paper text-base"
          hint={stable && !usdTouched.current ? "Filled 1:1 for a USD stablecoin. Edit it if needed." : "Used to compare with the threshold."}
          rules={{
            onChange: () => {
              usdTouched.current = true;
            },
          }}
        />
        <SelectField name="jurisdiction" label="Rulebook" hint={`${thresholdText(jurisdiction)} · ${getJurisdiction(jurisdiction).reference}`} className="sm:col-span-2">
          {JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>
              {j.name} ({j.code})
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        name="txHash"
        label="Transaction hash (optional)"
        hint="Only if it's already on-chain. You can attach it when you settle instead."
        mono
        maxLength={100}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
