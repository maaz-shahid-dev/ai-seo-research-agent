import { describe, expect, it } from "vitest";
import { normalizeEmail, registrationSchema, signInSchema } from "@/features/auth/schemas";

describe("authentication input", () => {
  it("normalizes email without changing the password", () => {
    const parsed = signInSchema.parse({
      email: "  Person@Example.COM ",
      password: "  a secure password  ",
    });

    expect(parsed.email).toBe("person@example.com");
    expect(parsed.password).toBe("  a secure password  ");
  });

  it("rejects short and oversized passwords", () => {
    expect(signInSchema.safeParse({ email: "a@example.com", password: "short" }).success).toBe(false);
    expect(
      signInSchema.safeParse({ email: "a@example.com", password: "é".repeat(65) }).success,
    ).toBe(false);
  });

  it("never accepts a role during registration", () => {
    const parsed = registrationSchema.parse({
      name: "Sam Rivera",
      email: "sam@example.com",
      password: "correct horse battery staple",
      role: "admin",
    });

    expect(parsed).not.toHaveProperty("role");
  });

  it("normalizes emails consistently", () => {
    expect(normalizeEmail(" TEST@Example.com ")).toBe("test@example.com");
  });
});
