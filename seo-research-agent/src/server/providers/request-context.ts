import { ProviderError, type ProviderName } from "./errors";

export const DEFAULT_PROVIDER_TIMEOUT_MS = 45_000;
export const MAX_PROVIDER_TIMEOUT_MS = 180_000;

export interface RequestAbortContext {
  signal: AbortSignal;
  didTimeout(): boolean;
  wasCallerAborted(): boolean;
  cleanup(): void;
}

export function createRequestAbortContext(
  timeoutMs: number,
  callerSignal?: AbortSignal,
): RequestAbortContext {
  const controller = new AbortController();
  let abortSource: "caller" | "timeout" | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const abortFromCaller = () => {
    if (abortSource !== null) {
      return;
    }

    abortSource = "caller";
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  if (abortSource === null) {
    timeout = setTimeout(() => {
      if (abortSource !== null) {
        return;
      }

      abortSource = "timeout";
      controller.abort(new DOMException("Provider request timed out", "TimeoutError"));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    didTimeout: () => abortSource === "timeout",
    wasCallerAborted: () => abortSource === "caller",
    cleanup: () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

export function invalidTimeoutForProvider(provider: ProviderName, timeoutMs: number) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_PROVIDER_TIMEOUT_MS) {
    throw new ProviderError(
      provider,
      "PROVIDER_INVALID_INPUT",
      `Provider timeout must be between 1 and ${MAX_PROVIDER_TIMEOUT_MS} milliseconds.`,
      false,
    );
  }

  return timeoutMs;
}
