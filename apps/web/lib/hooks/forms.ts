import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/lib/api";

/**
 * Puts an API error back onto the form: `ApiError.fields` (422) go to the
 * matching inputs, and `codeToField` routes coded errors (409 `email_taken`)
 * to one field. Focus moves to the first field that got an error.
 *
 * Returns the message to show in a `FormError`, or null when every part of
 * the error landed on a field.
 */
export function applyApiError<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  codeToField: Partial<Record<string, Path<T>>> = {},
): string | null {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : "Something went wrong.";

  const known = new Set(Object.keys(form.getValues()));
  const targets: [Path<T>, string][] = [];

  const coded = codeToField[error.code];
  if (coded) targets.push([coded, error.message]);

  for (const [name, message] of Object.entries(error.fields)) {
    const root = name.split(".")[0] ?? name;
    if (known.has(root)) targets.push([name as Path<T>, message]);
  }

  targets.forEach(([name, message], i) => form.setError(name, { type: "server", message }, { shouldFocus: i === 0 }));

  const unmapped = Object.keys(error.fields).some((name) => !known.has(name.split(".")[0] ?? name));
  if (targets.length > 0 && !unmapped) return null;
  return error.message;
}
