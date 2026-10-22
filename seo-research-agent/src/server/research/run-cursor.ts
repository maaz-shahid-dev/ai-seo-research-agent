import "server-only";

import { z } from "zod";

import { AppError } from "@/server/http/errors";

const cursorSchema = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).strict();

/** Opaque pagination cursor for research history ("created at" + id, newest first). */
export function encodeRunCursor(cursor: { createdAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString("base64url");
}

export function decodeRunCursor(value: string) {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    throw new AppError("Invalid history cursor.", "VALIDATION_ERROR", 400, false);
  }
}
