import { describe, expect, it } from "vitest";
import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword,
  verifyPasswordOrDummy,
} from "@/features/auth/password";

describe("password hashing", () => {
  it("hashes with Argon2id and verifies only the correct password", async () => {
    const digest = await hashPassword("correct horse battery staple");

    expect(digest).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(digest, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(digest, "wrong password")).resolves.toBe(false);
    expect(passwordHashNeedsUpgrade(digest)).toBe(false);
  });

  it("performs a dummy verification for unknown accounts and always fails", async () => {
    await expect(verifyPasswordOrDummy(null, "some supplied password")).resolves.toBe(false);
  });

  it("treats malformed or obsolete hashes as needing replacement", async () => {
    await expect(verifyPassword("not-a-password-hash", "password")).resolves.toBe(false);
    expect(passwordHashNeedsUpgrade("not-a-password-hash")).toBe(true);
  });
});
