"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "seo-research:sidebar";
/** Below this width (but above the mobile drawer breakpoint) the sidebar starts as an icon rail. */
const WIDE_QUERY = "(min-width: 1280px)";

type Preference = "collapsed" | "expanded" | null;

const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): the choice lasts for this visit.
let memoryPreference: Preference = null;

function wideQuery() {
  return typeof window.matchMedia === "function" ? window.matchMedia(WIDE_QUERY) : null;
}

function subscribe(onChange: () => void) {
  const query = wideQuery();
  query?.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  listeners.add(onChange);
  return () => {
    query?.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
    listeners.delete(onChange);
  };
}

function readPreference(): Preference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "collapsed" || value === "expanded" ? value : null;
  } catch {
    return memoryPreference;
  }
}

function writePreference(value: Exclude<Preference, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    memoryPreference = value;
  }
  for (const listener of listeners) listener();
}

/**
 * Desktop sidebar state: follows the screen width (an icon rail on medium
 * screens) until the user toggles it, then remembers their choice.
 */
export function useSidebarCollapsed() {
  // The server snapshot assumes a wide screen with no saved choice.
  const collapsed = useSyncExternalStore(
    subscribe,
    () => {
      const preference = readPreference();
      return preference ? preference === "collapsed" : !(wideQuery()?.matches ?? true);
    },
    () => false,
  );
  const toggle = useCallback(() => writePreference(collapsed ? "expanded" : "collapsed"), [collapsed]);
  return { collapsed, toggle };
}
