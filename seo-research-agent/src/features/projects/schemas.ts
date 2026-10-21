import { z } from "zod";

export const projectIdSchema = z.string().uuid("Invalid project.");

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Choose a valid country.")
  .transform((value) => value.toUpperCase());

export const languageCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, "Choose a valid language.");

export const projectNameSchema = z
  .string()
  .trim()
  .min(2, "Enter a project name.")
  .max(120, "Use no more than 120 characters.");

export const targetDomainSchema = z
  .string()
  .trim()
  .max(253)
  .transform((value, context) => {
    if (!value) return null;

    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) {
        context.addIssue({ code: "custom", message: "Enter a public website domain." });
        return z.NEVER;
      }

      const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
      if (!isPublicHostname(hostname)) {
        context.addIssue({ code: "custom", message: "Enter a public website domain." });
        return z.NEVER;
      }

      return hostname;
    } catch {
      context.addIssue({ code: "custom", message: "Enter a valid website domain." });
      return z.NEVER;
    }
  });

export const createProjectSchema = z.object({
  name: projectNameSchema,
  countryCode: countryCodeSchema,
  languageCode: languageCodeSchema,
  targetDomain: targetDomainSchema.optional().transform((value) => value ?? null),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    countryCode: countryCodeSchema.optional(),
    languageCode: languageCodeSchema.optional(),
    targetDomain: targetDomainSchema.optional(),
    archived: z.boolean().optional(),
    version: z.number().int().positive(),
  })
  .refine(
    ({ name, countryCode, languageCode, targetDomain, archived }) =>
      name !== undefined ||
      countryCode !== undefined ||
      languageCode !== undefined ||
      targetDomain !== undefined ||
      archived !== undefined,
    "No changes were provided.",
  );

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

function isPublicHostname(hostname: string) {
  if (!hostname.includes(".") || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false;
  }

  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
  if (hostname === "[::1]" || hostname.endsWith(".local")) return false;

  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname);
}
