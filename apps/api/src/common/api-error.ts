import { HttpException, HttpStatus } from "@nestjs/common";
import type { ApiErrorBody } from "@hera/core";

/** An error that already knows its wire shape. Everything else is mapped by the exception filter. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message, status);
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, ...(this.fields ? { fields: this.fields } : {}) } };
  }
}

export const unauthenticated = (message = "Sign in to continue.") =>
  new ApiError(HttpStatus.UNAUTHORIZED, "unauthenticated", message);

export const forbidden = (message = "You don't have permission to do that.") =>
  new ApiError(HttpStatus.FORBIDDEN, "forbidden", message);

export const notFound = (what = "That record") => new ApiError(HttpStatus.NOT_FOUND, "not_found", `${what} was not found.`);

export const conflict = (code: string, message: string) => new ApiError(HttpStatus.CONFLICT, code, message);

export const validationFailed = (fields: Record<string, string>, message = "Some fields need attention.") =>
  new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "validation_failed", message, fields);
