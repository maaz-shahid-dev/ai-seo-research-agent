export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Anything other than "dark" (missing, tampered) means light. */
export function parseTheme(value: string | undefined | null): Theme {
  return value === "dark" ? "dark" : "light";
}

/** Applies the theme now and remembers it, so the server renders it on the next load without a flash. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}
