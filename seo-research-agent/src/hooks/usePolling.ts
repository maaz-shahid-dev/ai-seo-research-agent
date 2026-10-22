"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, errorMessage, isAbortError } from "@/lib/api-client";

const RETRY_BASE_MS = 2_500;
const MAX_RETRY_MS = 30_000;
export const RETRYING_MESSAGE = "Connection problem. Retrying…";

type PollingState<T> = { key: string | null; data: T | null; error: string | null };

/**
 * Loads a resource and keeps reloading it while `nextDelay` returns a delay.
 * `load` receives the attempt number, so the first call can differ (for
 * example a POST that starts a job, followed by GETs). Temporary failures
 * retry with exponential backoff; other failures stop and expose the message.
 * Changing `key` resets the state and starts over; a null key does nothing.
 */
export function usePolling<T>(
  key: string | null,
  load: (signal: AbortSignal, attempt: number) => Promise<T>,
  nextDelay: (data: T) => number | null,
) {
  const [state, setState] = useState<PollingState<T>>({ key, data: null, error: null });
  // Callers pass inline functions; refs keep the effect keyed only on `key`.
  const loadRef = useRef(load);
  const nextDelayRef = useRef(nextDelay);
  useEffect(() => {
    loadRef.current = load;
    nextDelayRef.current = nextDelay;
  });

  if (state.key !== key) {
    setState({ key, data: null, error: null });
  }

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let failures = 0;

    async function run() {
      try {
        const data = await loadRef.current(controller.signal, attempt);
        attempt += 1;
        failures = 0;
        setState({ key, data, error: null });
        const delay = nextDelayRef.current(data);
        if (delay !== null) timer = setTimeout(run, delay);
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        const retryable = error instanceof ApiError && error.retryable;
        setState((current) => ({ ...current, error: retryable ? RETRYING_MESSAGE : errorMessage(error) }));
        if (retryable) {
          failures += 1;
          timer = setTimeout(run, Math.min(RETRY_BASE_MS * 2 ** failures, MAX_RETRY_MS));
        }
      }
    }

    void run();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key]);

  return state.key === key ? { data: state.data, error: state.error } : { data: null, error: null };
}
