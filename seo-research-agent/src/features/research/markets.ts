/**
 * Markets research can run in. Must match the active rows in provider_markets
 * (seeded by migrations 0001 and 0006).
 */
export const MARKETS = [
  { countryCode: "US", name: "United States" },
  { countryCode: "GB", name: "United Kingdom" },
  { countryCode: "CA", name: "Canada" },
  { countryCode: "AU", name: "Australia" },
  { countryCode: "IN", name: "India" },
  { countryCode: "PK", name: "Pakistan" },
  { countryCode: "AE", name: "United Arab Emirates" },
  { countryCode: "SG", name: "Singapore" },
  { countryCode: "NZ", name: "New Zealand" },
  { countryCode: "ZA", name: "South Africa" },
  { countryCode: "NG", name: "Nigeria" },
  { countryCode: "PH", name: "Philippines" },
  { countryCode: "IE", name: "Ireland" },
] as const;

export type CountryCode = (typeof MARKETS)[number]["countryCode"];

export const MARKET_LANGUAGE = "en";

export function marketFor(countryCode: string) {
  return MARKETS.find((market) => market.countryCode === countryCode) ?? null;
}

export function isSupportedCountry(countryCode: string): countryCode is CountryCode {
  return marketFor(countryCode) !== null;
}
