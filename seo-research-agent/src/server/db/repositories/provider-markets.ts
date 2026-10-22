import "server-only";

import { and, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { providerMarkets } from "../schema";

export async function getProviderMarket(
  database: DatabaseClient,
  provider: string,
  countryCode: string,
  languageCode: string,
) {
  const [market] = await database
    .select()
    .from(providerMarkets)
    .where(
      and(
        eq(providerMarkets.provider, provider.trim().toLowerCase()),
        eq(providerMarkets.countryCode, countryCode.trim().toUpperCase()),
        eq(providerMarkets.languageCode, languageCode.trim()),
        eq(providerMarkets.active, true),
      ),
    )
    .limit(1);
  return market ?? null;
}
