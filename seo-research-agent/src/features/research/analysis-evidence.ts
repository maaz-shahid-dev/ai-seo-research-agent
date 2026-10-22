import "server-only";

import { createHash } from "node:crypto";

import type { KeywordResult } from "@/server/db/schema";
import type { ResearchAnalysis, ResearchEvidence } from "@/server/providers";

export const AI_ANALYSIS_PROVIDER = "openai" as const;
export const AI_ANALYSIS_TYPE = "niche" as const;
export const AI_ANALYSIS_PROMPT_VERSION = "niche-v1" as const;
export const AI_ANALYSIS_SCHEMA_VERSION = 1 as const;
export const MAX_ANALYSIS_EVIDENCE_ITEMS = 40;

type KeywordEvidenceSource = Pick<
  KeywordResult,
  | "id"
  | "keyword"
  | "source"
  | "intent"
  | "searchVolume"
  | "cpcMicros"
  | "competition"
  | "difficulty"
>;

export type AnalysisInputHashSource = {
  seedKeyword: string;
  countryCode: string;
  languageCode: string;
  model: string;
  promptVersion?: string;
  schemaVersion?: number;
  evidence: readonly ResearchEvidence[];
};

/** Builds a stable, bounded evidence set from persisted keyword facts only. */
export function buildKeywordEvidence(
  keywords: readonly KeywordEvidenceSource[],
): ResearchEvidence[] {
  const ordered = [...keywords]
    .sort((left, right) => left.id - right.id)
    .slice(0, MAX_ANALYSIS_EVIDENCE_ITEMS);
  const seenIds = new Set<number>();

  return ordered.map((keyword) => {
    assertKeywordId(keyword.id, seenIds);
    seenIds.add(keyword.id);

    const facts: ResearchEvidence["facts"] = [
      { label: "Source", value: humanizeToken(keyword.source) },
      { label: "Intent", value: humanizeToken(keyword.intent) },
    ];

    if (keyword.searchVolume !== null) {
      facts.push({ label: "Monthly searches", value: String(keyword.searchVolume) });
    }
    if (keyword.difficulty !== null) {
      facts.push({ label: "Keyword difficulty", value: String(keyword.difficulty) });
    }
    if (keyword.cpcMicros !== null) {
      facts.push({ label: "CPC (USD)", value: formatUsdMicros(keyword.cpcMicros) });
    }
    if (keyword.competition !== null) {
      facts.push({ label: "Competition", value: normalizeDecimal(keyword.competition) });
    }

    return {
      id: createKeywordEvidenceId(keyword.id),
      kind: "keyword",
      label: truncate(normalizeWhitespace(keyword.keyword), 200),
      url: null,
      facts,
    };
  });
}

export function createKeywordEvidenceId(keywordResultId: number) {
  assertKeywordId(keywordResultId);
  return `kw_${keywordResultId}`;
}

/** Hashes the exact normalized inputs that affect an analysis response. */
export function createAnalysisInputHash(input: AnalysisInputHashSource) {
  const canonical = {
    schemaVersion: input.schemaVersion ?? AI_ANALYSIS_SCHEMA_VERSION,
    promptVersion: normalizeWhitespace(input.promptVersion ?? AI_ANALYSIS_PROMPT_VERSION),
    model: normalizeWhitespace(input.model),
    seedKeyword: normalizeWhitespace(input.seedKeyword),
    countryCode: normalizeWhitespace(input.countryCode).toUpperCase(),
    languageCode: normalizeWhitespace(input.languageCode),
    evidence: input.evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: normalizeWhitespace(item.label),
      url: item.url,
      facts: item.facts.map((fact) => ({
        label: normalizeWhitespace(fact.label),
        value: normalizeWhitespace(fact.value),
      })),
    })),
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Returns distinct evidence IDs in first-citation order. */
export function collectAnalysisCitationIds(analysis: ResearchAnalysis) {
  const orderedStatements = [
    analysis.summary,
    ...analysis.opportunitySignals,
    ...analysis.risks,
    ...analysis.nextSteps,
  ];
  const seen = new Set<string>();
  const citationIds: string[] = [];

  for (const statement of orderedStatements) {
    for (const citationId of statement.citationIds) {
      if (!seen.has(citationId)) {
        seen.add(citationId);
        citationIds.push(citationId);
      }
    }
  }

  return citationIds;
}

function assertKeywordId(value: number, seenIds?: ReadonlySet<number>): asserts value is number {
  if (!Number.isSafeInteger(value) || value < 1 || seenIds?.has(value)) {
    throw new TypeError("Keyword evidence requires unique positive integer IDs.");
  }
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function truncate(value: string, maximum: number) {
  return [...value].slice(0, maximum).join("");
}

function humanizeToken(value: string) {
  const normalized = normalizeWhitespace(value).replace(/_/g, " ");
  return normalized.length === 0
    ? "Unknown"
    : `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function formatUsdMicros(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Keyword CPC evidence must be a non-negative integer.");
  }
  return (value / 1_000_000).toFixed(2);
}

function normalizeDecimal(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new TypeError("Keyword competition evidence must be between zero and one.");
  }
  return String(parsed);
}
