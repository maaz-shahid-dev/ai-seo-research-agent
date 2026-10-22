import { z } from "zod";

import { displayNameSchema } from "@/features/auth/schemas";
import { MARKETS } from "@/features/research/markets";

export const THEMES = ["light", "dark"] as const;
export const TABLE_DENSITIES = ["comfortable", "compact"] as const;

const countryCodes = MARKETS.map((market) => market.countryCode) as [string, ...string[]];

/** PATCH /api/me/settings: any subset of fields; null country means "use the project's market". */
export const settingsUpdateSchema = z
  .object({
    displayName: displayNameSchema,
    defaultCountryCode: z.enum(countryCodes).nullable(),
    theme: z.enum(THEMES),
    tableDensity: z.enum(TABLE_DENSITIES),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Change at least one setting.");

export type SettingsDto = {
  email: string;
  displayName: string;
  defaultCountryCode: string | null;
  theme: (typeof THEMES)[number];
  tableDensity: (typeof TABLE_DENSITIES)[number];
};
