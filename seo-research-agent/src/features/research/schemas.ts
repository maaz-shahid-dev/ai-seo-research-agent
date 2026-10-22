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

export type ResearchRequestInput = z.infer<typeof researchRequestSchema>;

export function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
