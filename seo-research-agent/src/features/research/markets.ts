/**
 * Markets research can run in. Must match the active rows in provider_markets
 * (seeded by migrations 0001 and 0006).
 */
export const MARKETS = [
  { countryCode: "US", name: "United States", flag: "🇺🇸" },
  { countryCode: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { countryCode: "CA", name: "Canada", flag: "🇨🇦" },
  { countryCode: "AU", name: "Australia", flag: "🇦🇺" },
  { countryCode: "IN", name: "India", flag: "🇮🇳" },
  { countryCode: "PK", name: "Pakistan", flag: "🇵🇰" },
  { countryCode: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { countryCode: "SG", name: "Singapore", flag: "🇸🇬" },
  { countryCode: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { countryCode: "ZA", name: "South Africa", flag: "🇿🇦" },
  { countryCode: "NG", name: "Nigeria", flag: "🇳🇬" },
  { countryCode: "PH", name: "Philippines", flag: "🇵🇭" },
  { countryCode: "IE", name: "Ireland", flag: "🇮🇪" },
] as const;

export type CountryCode = (typeof MARKETS)[number]["countryCode"];

export const MARKET_LANGUAGE = "en";

export function marketFor(countryCode: string) {
  return MARKETS.find((market) => market.countryCode === countryCode) ?? null;
}

export function isSupportedCountry(countryCode: string): countryCode is CountryCode {
  return marketFor(countryCode) !== null;
}
