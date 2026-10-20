import "server-only";

import { hash, parseOptions, verify } from "@node-rs/argon2";
import type { Options } from "@node-rs/argon2";

export const passwordHashPolicy = {
  algorithm: 2,
  version: 1,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const satisfies Options;

// A fixed, non-secret Argon2id digest keeps unknown-account verification close
// to the cost of a real password check without creating work on every request.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$NGDHXAOSHtpaz2oMkIoGOw$ckHmISZjyEK10F+4h0G/SLvOaSY2oq0/n9VQ+vIwltA";

export async function hashPassword(password: string) {
  return hash(password, passwordHashPolicy);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function verifyPasswordOrDummy(passwordHash: string | null | undefined, password: string) {
  const matches = await verifyPassword(passwordHash ?? DUMMY_PASSWORD_HASH, password);
  return Boolean(passwordHash) && matches;
}

export function passwordHashNeedsUpgrade(passwordHash: string) {
  try {
    const current = parseOptions(passwordHash);
    return (
      current.algorithm !== passwordHashPolicy.algorithm ||
      current.version !== passwordHashPolicy.version ||
      current.memoryCost < passwordHashPolicy.memoryCost ||
      current.timeCost < passwordHashPolicy.timeCost ||
      current.parallelism !== passwordHashPolicy.parallelism ||
      current.outputLen < passwordHashPolicy.outputLen
    );
  } catch {
    return true;
  }
}
