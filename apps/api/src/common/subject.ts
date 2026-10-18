import { type ParseSubjectInput, parseSubject, type SubjectRef } from "@hera/core";
import { validationFailed } from "./api-error";

/** parseSubject, with its error attached to the request field it came from. */
export function parseSubjectOrThrow(input: ParseSubjectInput, field: string): SubjectRef {
  const parsed = parseSubject(input);
  if (!parsed.ok) throw validationFailed({ [field]: parsed.error }, parsed.error);
  return parsed.subject;
}
