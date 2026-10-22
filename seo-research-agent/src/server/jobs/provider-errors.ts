import "server-only";

import { NonRetriableError } from "inngest";

import { ProviderError } from "@/server/providers";

/** Runs a provider call; non-retryable provider errors stop Inngest retries immediately. */
export async function withProviderErrors<T>(call: () => Promise<T>) {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ProviderError && !error.retryable) {
      throw new NonRetriableError(`${error.code}: ${error.message}`, { cause: error });
    }
    throw error;
  }
}
