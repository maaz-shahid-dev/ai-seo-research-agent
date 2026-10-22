import "server-only";

import { inArray, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { domainMetrics } from "../schema";

export const DOMAIN_METRICS_TTL_MS = 30 * 24 * 60 * 60_000;

export type DomainMetricsInput = {
  domain: string;
  authority: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  monthlyTraffic: number | null;
  rankingKeywords: number | null;
  registeredAt: string | null;
};

export async function getDomainMetrics(database: DatabaseClient, domains: readonly string[]) {
  const unique = [...new Set(domains)];
  if (unique.length === 0) return [];
  return database.select().from(domainMetrics).where(inArray(domainMetrics.domain, unique));
}

/** Domains with no cached metrics or an expired entry, i.e. the ones worth paying for. */
export async function findStaleDomains(database: DatabaseClient, domains: readonly string[], now = new Date()) {
  const cached = await getDomainMetrics(database, domains);
  const fresh = new Set(cached.filter((row) => row.expiresAt > now).map((row) => row.domain));
  return [...new Set(domains)].filter((domain) => !fresh.has(domain));
}

/** Inserts or refreshes cached metrics in one statement. */
export async function upsertDomainMetrics(
  database: DatabaseClient,
  items: readonly DomainMetricsInput[],
  now = new Date(),
) {
  if (items.length === 0) return;
  const expiresAt = new Date(now.getTime() + DOMAIN_METRICS_TTL_MS);
  await database
    .insert(domainMetrics)
    .values(items.map((item) => ({
      domain: item.domain.trim().toLowerCase(),
      authority: clampOrNull(item.authority, 0, 100),
      backlinks: clampOrNull(item.backlinks, 0, Number.MAX_SAFE_INTEGER),
      referringDomains: clampOrNull(item.referringDomains, 0, 2_147_483_647),
      monthlyTraffic: clampOrNull(item.monthlyTraffic, 0, Number.MAX_SAFE_INTEGER),
      rankingKeywords: clampOrNull(item.rankingKeywords, 0, Number.MAX_SAFE_INTEGER),
      registeredAt: item.registeredAt ? new Date(item.registeredAt) : null,
      fetchedAt: now,
      expiresAt,
    })))
    .onConflictDoUpdate({
      target: domainMetrics.domain,
      set: {
        authority: sql`excluded.authority`,
        backlinks: sql`excluded.backlinks`,
        referringDomains: sql`excluded.referring_domains`,
        monthlyTraffic: sql`excluded.monthly_traffic`,
        rankingKeywords: sql`excluded.ranking_keywords`,
        registeredAt: sql`excluded.registered_at`,
        fetchedAt: sql`excluded.fetched_at`,
        expiresAt: sql`excluded.expires_at`,
      },
    });
}

function clampOrNull(value: number | null, minimum: number, maximum: number) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}
