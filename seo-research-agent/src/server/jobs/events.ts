import { z } from "zod";

export const researchRequestedEventSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().uuid(),
    runId: z.string().uuid(),
  })
  .strict();

export const RESEARCH_REQUESTED_EVENT = "research.requested" as const;

export const analysisRequestedEventSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().uuid(),
    runId: z.string().uuid(),
    analysisId: z.string().uuid(),
  })
  .strict();

export const ANALYSIS_REQUESTED_EVENT = "analysis.requested" as const;

export const serpRequestedEventSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().uuid(),
    runId: z.string().uuid(),
    analysisId: z.string().uuid(),
  })
  .strict();

export const SERP_REQUESTED_EVENT = "serp.requested" as const;

export const contentGapRequestedEventSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().uuid(),
    runId: z.string().uuid(),
    reportId: z.string().uuid(),
  })
  .strict();

export const CONTENT_GAP_REQUESTED_EVENT = "content-gap.requested" as const;
