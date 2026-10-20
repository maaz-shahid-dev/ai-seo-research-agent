import { z } from "zod";

const MAX_PASSWORD_BYTES = 128;

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email("Enter a valid email address.")
  .transform(normalizeEmail);

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .refine(
    (password) => new TextEncoder().encode(password).byteLength <= MAX_PASSWORD_BYTES,
    `Use no more than ${MAX_PASSWORD_BYTES} bytes.`,
  );

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your name.")
  .max(80, "Use no more than 80 characters.")
  .regex(/^[\p{L}\p{M}\p{N} .'-]+$/u, "Use letters, numbers, spaces, apostrophes, periods, or hyphens.");

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registrationSchema = signInSchema.extend({
  name: displayNameSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}
