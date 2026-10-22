import { and, asc, count, eq, gt } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { keywordResults, type NewKeywordResult } from "../schema";

export type KeywordResultInput = {
  keyword: string;
  source: "seed" | "related" | "autocomplete" | "competitor";
  provider: string;
  providerRequestId?: string | null;
  retrievedAt: Date;
  intent?: "informational" | "navigational" | "commercial" | "transactional" | "unknown";
  countryCode: string;
  languageCode: string;
  searchVolume?: number | null;
  cpcMicros?: number | null;
  competition?: number | null;
  difficulty?: number | null;
  trend?: Array<{ month: string; volume: number }> | null;
};

export async function insertKeywordResults(
  database: DatabaseClient,
  ownerIdInput: string,
  runIdInput: string,
  input: KeywordResultInput[],
) {
  const ownerId = ownerIdInput;
  const runId = runIdInput;
  if (input.length > 500) {
    throw new RangeError("A research run cannot store more than 500 keyword results at once.");
  }

  const values: NewKeywordResult[] = input.map((value) => {
    const keyword = value.keyword.trim().replace(/\s+/g, " ");
    const provider = value.provider.trim();
    if (!keyword || keyword.length > 500 || !provider || provider.length > 80) {
      throw new TypeError("A keyword result contains invalid text.");
    }

    return {
      ownerId,
      runId,
      keyword,
      normalizedKeyword: normalizeKeyword(keyword),
      source: value.source,
      provider,
      providerRequestId: value.providerRequestId?.trim() || null,
      retrievedAt: value.retrievedAt,
      intent: value.intent,
      countryCode: value.countryCode.trim().toUpperCase(),
      languageCode: value.languageCode.trim(),
      searchVolume: value.searchVolume ?? null,
      cpcMicros: value.cpcMicros ?? null,
      competition: value.competition === null || value.competition === undefined
        ? null
        : value.competition.toFixed(4),
      difficulty: value.difficulty ?? null,
      trend: value.trend ?? null,
    };
  });

  if (values.length === 0) {
    return { insertedCount: 0, duplicateCount: 0 };
  }

  const inserted = await database
    .insert(keywordResults)
    .values(values)
    .onConflictDoNothing({
      target: [
        keywordResults.runId,
        keywordResults.normalizedKeyword,
        keywordResults.countryCode,
        keywordResults.languageCode,
      ],
    })
    .returning({ id: keywordResults.id });
  const insertedCount = inserted.length;

  return { insertedCount, duplicateCount: input.length - insertedCount };
}

export async function listKeywordResults(
  database: DatabaseClient,
  ownerIdInput: string,
  runIdInput: string,
  options: { afterId?: number; limit?: number } = {},
) {
  const ownerId = ownerIdInput;
  const runId = runIdInput;
  const afterId = options.afterId;
  const limit = boundedLimit(options.limit, 100, 250);
  const conditions = [eq(keywordResults.ownerId, ownerId), eq(keywordResults.runId, runId)];

  if (afterId !== undefined) {
    conditions.push(gt(keywordResults.id, afterId));
  }

  const rows = await database
    .select()
    .from(keywordResults)
    .where(and(...conditions))
    .orderBy(asc(keywordResults.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  };
}

export async function countKeywordResults(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
) {
  const [result] = await database
    .select({ value: count() })
    .from(keywordResults)
    .where(and(eq(keywordResults.ownerId, ownerId), eq(keywordResults.runId, runId)));
  return result?.value ?? 0;
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().replace(/\s+/g, " ").toLowerCase();
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  return Number.isSafeInteger(value) ? Math.min(Math.max(value!, 1), maximum) : fallback;
}

export async function getKeywordResult(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  keywordResultId: number,
) {
  const [keyword] = await database
    .select()
    .from(keywordResults)
    .where(and(
      eq(keywordResults.id, keywordResultId),
      eq(keywordResults.ownerId, ownerId),
      eq(keywordResults.runId, runId),
    ))
    .limit(1);
  return keyword ?? null;
}
