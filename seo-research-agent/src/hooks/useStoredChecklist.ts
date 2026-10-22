"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): ticks last for this visit.
const memory = new Map<string, string>();
const MAX_ITEMS = 100;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  listeners.add(onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    listeners.delete(onChange);
  };
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
  for (const listener of listeners) listener();
}

function parse(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, MAX_ITEMS) : []);
  } catch {
    return new Set();
  }
}

/** A set of ticked item ids kept in this browser under `key` (e.g. launch steps for one search). */
export function useStoredChecklist(key: string) {
  // The raw string is the snapshot so React sees a stable value between changes.
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const done = useMemo(() => parse(raw), [raw]);

  const toggle = useCallback((id: string) => {
    const next = new Set(parse(read(key)));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(key, JSON.stringify([...next]));
  }, [key]);

  return { done, toggle };
}
