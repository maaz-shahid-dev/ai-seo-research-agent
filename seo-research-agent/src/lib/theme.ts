export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

/** Anything other than "dark" (missing, tampered) means light. */
export function parseTheme(value: string | undefined | null): Theme {
  return value === "dark" ? "dark" : "light";
}

export function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

/** For useSyncExternalStore: notified whenever the theme changes in this tab. */
export function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Applies the theme now and remembers it, so the server renders it on the next load without a flash. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
  for (const listener of listeners) listener();
}

export function toggleTheme() {
  applyTheme(isDarkTheme() ? "light" : "dark");
}

export type Density = "comfortable" | "compact";
export const DENSITY_COOKIE = "density";

export function parseDensity(value: string | undefined | null): Density {
  return value === "compact" ? "compact" : "comfortable";
}

/** Tighter table rows; like the theme, remembered in a cookie so the server renders it. */
export function applyDensity(density: Density) {
  document.documentElement.classList.toggle("density-compact", density === "compact");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${DENSITY_COOKIE}=${density}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

export function currentDensity(): Density {
  return document.documentElement.classList.contains("density-compact") ? "compact" : "comfortable";
}
