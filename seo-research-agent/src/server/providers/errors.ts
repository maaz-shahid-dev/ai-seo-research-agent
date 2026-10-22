export type ProviderName = "dataforseo" | "openai";

export type ProviderErrorCode =
  | "PROVIDER_INVALID_INPUT"
  | "PROVIDER_ABORTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_NETWORK_ERROR"
  | "PROVIDER_HTTP_ERROR"
  | "PROVIDER_RESPONSE_INVALID"
  | "PROVIDER_REQUEST_FAILED"
  | "OPENAI_REFUSAL"
  | "OPENAI_INCOMPLETE"
  | "OPENAI_INVALID_CITATION";

interface ProviderErrorOptions extends ErrorOptions {
  httpStatus?: number;
  providerStatus?: number | string;
}

/**
 * A sanitized provider failure. It carries enough metadata for job retry policy
 * and logging without exposing credentials or untrusted upstream response bodies.
 */
export class ProviderError extends Error {
  readonly provider: ProviderName;
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly providerStatus?: number | string;

  constructor(
    provider: ProviderName,
    code: ProviderErrorCode,
    message: string,
    retryable: boolean,
    options: ProviderErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    this.httpStatus = options.httpStatus;
    this.providerStatus = options.providerStatus;
  }
}

export function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function isAbortError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "AbortError" || error.name === "TimeoutError";
}

export function errorStatus(error: unknown) {
  if (!isRecord(error)) {
    return undefined;
  }

  return typeof error.status === "number" ? error.status : undefined;
}

export function errorCode(error: unknown) {
  if (!isRecord(error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
