import { z } from "zod";
import { countryCodeSchema, languageCodeSchema, projectIdSchema } from "@/features/projects/schemas";

export const researchRunIdSchema = z.string().uuid("Invalid research run.");

export const researchRequestSchema = z.object({
  projectId: projectIdSchema,
  seed: z
    .string()
    .trim()
    .min(2, "Enter a topic or keyword.")
    .max(200, "Use no more than 200 characters."),
  countryCode: countryCodeSchema,
  languageCode: languageCodeSchema,
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  keywordLimit: z.number().int().min(10).max(500).default(100),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid idempotency key.");

export const researchSubmissionSchema = researchRequestSchema.extend({
  idempotencyKey: idempotencyKeySchema,
});

export const researchHistoryQuerySchema = z.object({
  projectId: projectIdSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().max(300).optional(),
});

/** A real calendar day as YYYY-MM-DD (rejects 2026-02-31). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
  }, "Invalid date.");

export const nicheIdeasQuerySchema = z
  .object({
    date: isoDateSchema.optional(),
    view: z.enum(["favorites"]).optional(),
  })
  .strict();

export const nicheIdeaIdSchema = z.string().uuid();

export const nicheIdeaReactionSchema = z
  .object({ status: z.enum(["favorite", "dismissed"]).nullable() })
  .strict();

export type ResearchRequestInput = z.infer<typeof researchRequestSchema>;

export function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
