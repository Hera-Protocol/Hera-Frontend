import {
  type ChainId,
  checkTravelRule,
  type CreateReportInput,
  createReportSchema,
  type CreateTravelRuleInput,
  createTravelRuleSchema,
  type CreateWalletInput,
  createWalletSchema,
  originatorHasIdentifier,
  parseSubject,
  type SubjectInput,
  subjectInputSchema,
  type SubjectRef,
  transitionTravelRuleSchema,
  type UpdateAlertInput,
  updateAlertSchema,
} from "@hera/core";
import { HeraValidationError } from "./errors";

/**
 * The same checks the API runs, in the same order, with the same messages, so
 * a typo fails offline with the error the server would have returned.
 */

const GENERIC_MESSAGE = "Some fields need attention.";

/** The slice of a zod schema we use, so the SDK needs no direct zod dependency. */
interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: SchemaError };
}
interface SchemaError {
  issues: { path: (string | number)[]; message: string }[];
}

function zodFields(error: SchemaError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

function invalid(fields: Record<string, string>, message = GENERIC_MESSAGE): HeraValidationError {
  return new HeraValidationError({ status: 422, code: "validation_failed", message, fields });
}

export function parseWith<T>(schema: Schema<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) throw invalid(zodFields(result.error));
  return result.data;
}

function subjectOrThrow(input: SubjectInput, field: string): SubjectRef {
  const parsed = parseSubject(input);
  if (!parsed.ok) throw invalid({ [field]: parsed.error }, parsed.error);
  return parsed.subject;
}

export type ScreenInput = SubjectInput | string;

export function normalizeSubject(input: ScreenInput): SubjectInput {
  if (typeof input === "string") return { address: input };
  if (!input || typeof input !== "object") throw invalid({ address: "Enter an address" });
  return input;
}

export function validateScreen(input: ScreenInput): { body: SubjectInput; subject: SubjectRef } {
  const body = parseWith(subjectInputSchema, normalizeSubject(input));
  return { body, subject: subjectOrThrow(body, "address") };
}

export function validateWallet(input: CreateWalletInput): CreateWalletInput {
  const body = parseWith(createWalletSchema, input);
  subjectOrThrow(body, "address");
  return body;
}

export function validateAlertUpdate(input: UpdateAlertInput): UpdateAlertInput {
  return parseWith(updateAlertSchema, input);
}

function accountOrThrow(input: SubjectInput, chain: ChainId, field: string): void {
  const subject = subjectOrThrow({ ...input, chain: input.chain ?? chain }, `${field}.address`);
  if (subject.chain !== chain) throw invalid({ [`${field}.address`]: `This address isn't on ${chain}.` });
}

export function validateTravelRule(input: CreateTravelRuleInput): CreateTravelRuleInput {
  const body = parseWith(createTravelRuleSchema, input);
  accountOrThrow(body.originatorAccount, body.chain, "originatorAccount");
  accountOrThrow(body.beneficiaryAccount, body.chain, "beneficiaryAccount");
  const check = checkTravelRule({ amountUsd: body.amountUsd, jurisdiction: body.jurisdiction, counterpartyHosted: body.beneficiaryVasp !== null });
  if (check.required && !originatorHasIdentifier(body.originator)) {
    throw invalid({ originator: "Add a customer ID, national ID, address, or date and place of birth for the originator." });
  }
  return body;
}

export function validateTransition(to: string, note?: string): { to: string; note?: string } {
  return parseWith(transitionTravelRuleSchema, note === undefined ? { to } : { to, note });
}

export function validateReport(input: CreateReportInput): CreateReportInput {
  return parseWith(createReportSchema, input);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are uuids. Anything else would 404, so fail early with a clearer message. */
export function assertId(id: string, what: string): string {
  if (typeof id !== "string" || !UUID.test(id)) {
    throw invalid({ id: `Expected a ${what} id (uuid).` }, `"${String(id)}" is not a valid ${what} id.`);
  }
  return id;
}
