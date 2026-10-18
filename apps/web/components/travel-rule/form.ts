import {
  type ChainId,
  checkTravelRule,
  createTravelRuleSchema,
  type CreateTravelRuleInput,
  type IvmsPerson,
  originatorHasIdentifier,
  parseSubject,
  type ParseSubjectResult,
} from "@hera/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, get, type Resolver, set } from "react-hook-form";

/* ─── Form shape ─────────────────────────────────────── */

/** Both person shapes live side by side, so switching natural ↔ legal never loses typing. */
export interface PersonForm {
  type: "natural" | "legal";
  firstName: string;
  lastName: string;
  legalName: string;
  lei: string;
  customerId: string;
  nationalId: string;
  dateOfBirth: string;
  placeOfBirth: string;
  address: { street: string; city: string; country: string };
}

export interface AccountForm {
  address: string;
  memo: { type: "id" | "text" | "hash"; value: string };
}

export interface VaspForm {
  name: string;
  lei: string;
  domain: string;
}

export interface TravelRuleFormValues {
  direction: "outgoing" | "incoming";
  chain: ChainId;
  asset: string;
  amount: string;
  amountUsd: string;
  txHash: string;
  jurisdiction: string;
  originator: PersonForm;
  originatorAccount: AccountForm;
  beneficiary: PersonForm;
  beneficiaryAccount: AccountForm;
  /** null = self-hosted wallet. */
  beneficiaryVasp: VaspForm | null;
}

const emptyPerson = (): PersonForm => ({
  type: "natural",
  firstName: "",
  lastName: "",
  legalName: "",
  lei: "",
  customerId: "",
  nationalId: "",
  dateOfBirth: "",
  placeOfBirth: "",
  address: { street: "", city: "", country: "" },
});

export const emptyVasp = (): VaspForm => ({ name: "", lei: "", domain: "" });

export function defaultValues(beneficiaryAddress = ""): TravelRuleFormValues {
  const detected = detectChain(beneficiaryAddress);
  return {
    direction: "outgoing",
    chain: detected ?? "stellar",
    asset: "USDC",
    amount: "",
    amountUsd: "",
    txHash: "",
    jurisdiction: "FATF",
    originator: emptyPerson(),
    originatorAccount: { address: "", memo: { type: "id", value: "" } },
    beneficiary: emptyPerson(),
    beneficiaryAccount: { address: beneficiaryAddress, memo: { type: "id", value: "" } },
    beneficiaryVasp: emptyVasp(),
  };
}

/* ─── Steps ──────────────────────────────────────────── */

export const STEPS = [
  { key: "parties", label: "Parties", fields: ["direction", "originator", "beneficiary"] },
  { key: "accounts", label: "Accounts", fields: ["originatorAccount", "beneficiaryAccount", "beneficiaryVasp"] },
  { key: "amount", label: "Amount", fields: ["chain", "asset", "amount", "amountUsd", "txHash", "jurisdiction"] },
  { key: "review", label: "Review", fields: [] },
] as const;

export type StepFields = (typeof STEPS)[number]["fields"][number];

/** Which step owns a field path such as `originatorAccount.address`. */
export function stepForPath(path: string): number {
  const root = path.split(".")[0] as StepFields;
  const index = STEPS.findIndex((s) => (s.fields as readonly string[]).includes(root));
  return index < 0 ? STEPS.length - 1 : index;
}

/* ─── Payload ────────────────────────────────────────── */

const opt = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : undefined;
};

/** Drop empty optional fields so zod's `.length(2)` and LEI regex only see real input. */
export function toPerson(p: PersonForm): IvmsPerson {
  const street = opt(p.address.street);
  const city = opt(p.address.city);
  const country = opt(p.address.country);
  const address = street || city || country ? { street, city, country } : undefined;
  const common = { customerId: opt(p.customerId), ...(address ? { address } : {}) };
  return p.type === "natural"
    ? {
        type: "natural",
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        dateOfBirth: opt(p.dateOfBirth),
        placeOfBirth: opt(p.placeOfBirth),
        nationalId: opt(p.nationalId),
        ...common,
      }
    : { type: "legal", legalName: p.legalName.trim(), lei: opt(p.lei)?.toUpperCase(), ...common };
}

function toAccount(a: AccountForm) {
  const value = a.memo.value.trim();
  return { address: a.address.trim(), ...(value ? { memo: { type: a.memo.type, value } } : {}) };
}

/** "2,500.00" → "2500.00"; "$1,200" → "1200". */
export const cleanNumber = (v: string) => v.replace(/[\s,$]/g, "");

export function parseUsd(v: string): number | null {
  const n = Number(cleanNumber(v));
  return cleanNumber(v) && Number.isFinite(n) && n >= 0 ? n : null;
}

export function toPayload(v: TravelRuleFormValues) {
  return {
    direction: v.direction,
    chain: v.chain,
    asset: v.asset.trim().toUpperCase(),
    amount: cleanNumber(v.amount),
    amountUsd: cleanNumber(v.amountUsd),
    ...(opt(v.txHash) ? { txHash: v.txHash.trim() } : {}),
    jurisdiction: v.jurisdiction,
    originator: toPerson(v.originator),
    originatorAccount: toAccount(v.originatorAccount),
    beneficiary: toPerson(v.beneficiary),
    beneficiaryAccount: toAccount(v.beneficiaryAccount),
    beneficiaryVasp: v.beneficiaryVasp
      ? { name: v.beneficiaryVasp.name.trim(), lei: opt(v.beneficiaryVasp.lei), domain: opt(v.beneficiaryVasp.domain) }
      : null,
  };
}

/* ─── Subjects ───────────────────────────────────────── */

export function parseAccount(a: AccountForm, chain: ChainId): ParseSubjectResult | null {
  if (!a.address.trim()) return null;
  const memo = a.memo.value.trim() ? a.memo : undefined;
  return parseSubject({ address: a.address, chain: chain === "stellar" ? undefined : chain, memo });
}

export function detectChain(address: string): ChainId | null {
  const t = address.trim();
  if (/^[GM]/.test(t)) return "stellar";
  if (/^0x/i.test(t)) return "evm:1";
  return null;
}

/* ─── Live rule check ────────────────────────────────── */

export function liveCheck(v: TravelRuleFormValues) {
  const usd = parseUsd(v.amountUsd);
  const check = checkTravelRule({ amountUsd: usd ?? 0, jurisdiction: v.jurisdiction, counterpartyHosted: v.beneficiaryVasp !== null });
  return { check, usd, hasIdentifier: originatorHasIdentifier(toPerson(v.originator)) };
}

export const IDENTIFIER_MESSAGE = "Add a customer ID, national ID, address (city or street, plus country), or date and place of birth.";

/* ─── Resolver ───────────────────────────────────────── */

const zod = zodResolver(createTravelRuleSchema);

type Errors = FieldErrors<TravelRuleFormValues>;

function put(errors: Errors, path: string, message: string, override = false) {
  if (!override && get(errors, path)) return;
  set(errors, path, { type: "validate", message });
}

/**
 * The core schema, plus the checks the API makes that zod can't express:
 * addresses must parse (muxed, memo, EIP-55) and sit on the chosen chain.
 * Friendlier messages replace zod's generic ones.
 */
export const travelRuleResolver: Resolver<TravelRuleFormValues, unknown, CreateTravelRuleInput> = async (values, context, options) => {
  const result = await zod(toPayload(values) as never, context, options as never);
  const errors: Errors = { ...(result.errors as Errors) };

  if (!values.asset.trim()) put(errors, "asset", "Enter the asset code, e.g. USDC.", true);
  const amount = Number(cleanNumber(values.amount));
  if (!cleanNumber(values.amount)) put(errors, "amount", "Enter an amount.", true);
  else if (!/^\d+(\.\d+)?$/.test(cleanNumber(values.amount))) put(errors, "amount", "Use digits and a decimal point, e.g. 2500.00.", true);
  else if (amount <= 0) put(errors, "amount", "The amount must be more than zero.", true);
  if (parseUsd(values.amountUsd) === null) put(errors, "amountUsd", "Enter the value in USD. It decides whether the rule applies.", true);

  for (const field of ["originatorAccount", "beneficiaryAccount"] as const) {
    const parsed = parseAccount(values[field], values.chain);
    if (!parsed) put(errors, `${field}.address`, "Enter an address.", true);
    else if (!parsed.ok) put(errors, `${field}.address`, parsed.error, true);
    else if (parsed.subject.chain !== values.chain) {
      put(errors, "chain", `The accounts are on ${parsed.subject.chain === "stellar" ? "Stellar" : "an EVM chain"}. Pick that chain, or change the accounts.`);
    }
  }

  if (Object.keys(errors).length > 0) return { values: {}, errors };
  return result;
};
