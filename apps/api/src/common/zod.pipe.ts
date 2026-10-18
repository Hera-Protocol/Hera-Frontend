import type { PipeTransform } from "@nestjs/common";
import type { ZodError, ZodType, ZodTypeDef } from "zod";
import { validationFailed } from "./api-error";

/** Field path → first message, e.g. `{ "originator.firstName": "Required" }`. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Validates a body or query against a schema from @hera/core and returns the parsed value. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) throw validationFailed(zodFields(result.error));
    return result.data;
  }
}
