"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { isDarkTheme, subscribeTheme, toggleTheme } from "@/lib/theme";

/** Switches between light and dark; the server already rendered the saved choice. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDarkTheme, () => false);
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
