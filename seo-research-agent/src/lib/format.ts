const numberFormat = new Intl.NumberFormat("en-US");
const currencyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const relativeFormat = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const EMPTY = "—";

export function formatNumber(value: number | null) {
  return value === null ? EMPTY : numberFormat.format(value);
}

/** Provider prices are stored in micros (1 USD = 1,000,000). */
export function formatCurrencyMicros(value: number | null) {
  return value === null ? EMPTY : currencyFormat.format(value / 1_000_000);
}

/** "just now", "5 minutes ago", "yesterday", then a short date after a week. */
export function formatRelativeTime(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const elapsed = Math.abs(seconds);

  if (elapsed < 60) return "just now";
  if (elapsed < 3_600) return relativeFormat.format(Math.round(seconds / 60), "minute");
  if (elapsed < 86_400) return relativeFormat.format(Math.round(seconds / 3_600), "hour");
  if (elapsed < 604_800) return relativeFormat.format(Math.round(seconds / 86_400), "day");
  return dateFormat.format(date);
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
