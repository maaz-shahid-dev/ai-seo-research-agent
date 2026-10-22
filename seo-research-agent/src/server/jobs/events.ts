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
