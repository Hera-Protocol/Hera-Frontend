import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ApiErrorBody } from "@hera/core";
import { ThrottlerException } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ApiError } from "./api-error";

const CODE_BY_STATUS: Record<number, string> = {
  400: "bad_request",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  409: "conflict",
  413: "payload_too_large",
  415: "unsupported_media_type",
  422: "validation_failed",
  429: "rate_limited",
};

/** Every error leaves the API as `ApiErrorBody`, whatever threw it. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const { status, body } = this.toBody(exception);
    const where = `[${request.requestId ?? "-"}] ${request.method} ${request.originalUrl ?? request.url}`;
    // Our own 5xx errors (e.g. chain_unavailable) are expected upstream failures; anything else is a bug.
    if (exception instanceof ApiError && status >= 500) this.logger.warn(`${where} ${body.error.code}: ${body.error.message}`);
    else if (status >= 500) this.logger.error(`${where} ${exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)}`);
    response.status(status).json(body);
  }

  private toBody(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ApiError) return { status: exception.getStatus(), body: exception.toBody() };

    if (exception instanceof ThrottlerException) {
      return { status: 429, body: { error: { code: "rate_limited", message: "Too many requests. Try again in a minute." } } };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = CODE_BY_STATUS[status] ?? (status >= 500 ? "internal_error" : "error");
      const message = status === 404 ? "Not found." : exception.message;
      return { status, body: { error: { code, message } } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: "internal_error", message: "Something went wrong on our side." } },
    };
  }
}
