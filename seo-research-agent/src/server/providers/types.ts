import { z } from "zod";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const searchIntentSchema = z.enum([
  "informational",
  "navigational",
  "commercial",
  "transactional",
]);

export type SearchIntent = z.infer<typeof searchIntentSchema>;

export const keywordIdeasRequestSchema = z
  .object({
    keywords: z.array(boundedText(700)).min(1).max(200),
    locationCode: z.number().int().positive(),
    languageCode: boundedText(16).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
    limit: z.number().int().min(1).max(1_000).default(100),
  })
  .strict();

export type KeywordIdeasRequest = z.input<typeof keywordIdeasRequestSchema>;

export const organicSerpRequestSchema = z
  .object({
    keyword: boundedText(700),
    locationCode: z.number().int().positive(),
    languageCode: boundedText(16).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
    depth: z.number().int().min(1).max(200).default(10),
    device: z.enum(["desktop", "mobile"]).default("desktop"),
  })
  .strict();

export type OrganicSerpRequest = z.input<typeof organicSerpRequestSchema>;

export interface MonthlySearchVolume {
  year: number;
  month: number;
  searchVolume: number | null;
}

export interface NormalizedKeywordIdea {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  competitionLevel: string | null;
  keywordDifficulty: number | null;
  intent: SearchIntent | null;
  monthlySearches: MonthlySearchVolume[];
}

export interface DataForSeoPartialWarning {
  code: "DATAFORSEO_PARTIAL_RESULTS";
  message: string;
  providerStatus: 40_106;
}

export type DataForSeoResultOutcome =
  | { outcome: "complete"; warning: null }
  | { outcome: "empty"; warning: null }
  | { outcome: "partial"; warning: DataForSeoPartialWarning };

interface KeywordIdeasResultPayload {
  taskId: string;
  cost: number | null;
  totalCount: number | null;
  items: NormalizedKeywordIdea[];
}

export type KeywordIdeasResult = KeywordIdeasResultPayload & DataForSeoResultOutcome;

export interface NormalizedOrganicResult {
  rank: number | null;
  rankAbsolute: number | null;
  title: string | null;
  description: string | null;
  url: string | null;
  domain: string | null;
}

interface OrganicSerpResultPayload {
  taskId: string;
  cost: number | null;
  keyword: string;
  checkedAt: string | null;
  totalResults: number | null;
  features: string[];
  items: NormalizedOrganicResult[];
}

export type OrganicSerpResult = OrganicSerpResultPayload & DataForSeoResultOutcome;

export interface ProviderRequestOptions {
  signal?: AbortSignal;
}

/**
 * Normalizes an untrusted value for a user-visible HTTP(S) link.
 * This does not make a URL safe for server-side fetching or prevent SSRF.
 */
export function normalizeLinkHttpUrl(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

export function normalizeDomain(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (domain.length === 0 || domain.length > 253) {
    return null;
  }

  const labels = domain.split(".");
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  ) {
    return null;
  }

  return domain;
}

export const evidenceIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

const evidenceFactSchema = z
  .object({
    label: boundedText(80),
    value: boundedText(500),
  })
  .strict();

export const researchEvidenceSchema = z
  .object({
    id: evidenceIdSchema,
    kind: z.enum(["keyword", "organic"]),
    label: boundedText(200),
    url: z
      .string()
      .max(4_096)
      .refine((value) => normalizeLinkHttpUrl(value) !== null, "Must be an HTTP(S) link URL")
      .nullable(),
    facts: z.array(evidenceFactSchema).min(1).max(12),
  })
  .strict();

export type ResearchEvidence = z.infer<typeof researchEvidenceSchema>;

export const researchAnalysisRequestSchema = z
  .object({
    ownerId: boundedText(128).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
    seedKeyword: boundedText(700),
    country: boundedText(100),
    language: boundedText(100),
    evidence: z.array(researchEvidenceSchema).min(1).max(40),
  })
  .strict()
  .superRefine((request, context) => {
    const ids = new Set<string>();
    for (const item of request.evidence) {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "Evidence IDs must be unique.",
          path: ["evidence"],
        });
      }
      ids.add(item.id);
    }

    if (JSON.stringify(request.evidence).length > 30_000) {
      context.addIssue({
        code: "custom",
        message: "Evidence exceeds the 30000-character request budget.",
        path: ["evidence"],
      });
    }
  });

export type ResearchAnalysisRequest = z.input<typeof researchAnalysisRequestSchema>;

export const citedStatementSchema = z
  .object({
    statement: boundedText(600),
    citationIds: z.array(evidenceIdSchema).min(1).max(8),
  })
  .strict();

export const researchAnalysisSchema = z
  .object({
    summary: citedStatementSchema,
    opportunitySignals: z.array(citedStatementSchema).max(8),
    risks: z.array(citedStatementSchema).max(8),
    missingEvidence: z.array(boundedText(400)).max(8),
    nextSteps: z.array(citedStatementSchema).max(8),
  })
  .strict();

export type ResearchAnalysis = z.infer<typeof researchAnalysisSchema>;

export interface ResearchAnalysisResult {
  responseId: string;
  model: string;
  analysis: ResearchAnalysis;
}
