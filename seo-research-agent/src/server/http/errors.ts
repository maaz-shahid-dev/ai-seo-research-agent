import "server-only";

import { ZodError } from "zod";
import { logger } from "@/server/logging/logger";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown, requestId = crypto.randomUUID()) {
  if (error instanceof AppError) {
    logError(error, requestId);
    return Response.json(
      { error: { code: error.code, message: error.message, requestId, retryable: error.retryable } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    logger.info({ requestId, issues: error.issues }, "Request validation failed");
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields and try again.",
          requestId,
          retryable: false,
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  logError(error, requestId);
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Try again.",
        requestId,
        retryable: true,
      },
    },
    { status: 500 },
  );
}

function logError(error: unknown, requestId: string) {
  if (error instanceof AppError && error.status < 500) {
    logger.warn({ requestId, code: error.code, status: error.status }, error.message);
    return;
  }

  logger.error({ requestId, error }, "Unhandled request failure");
}
