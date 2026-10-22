import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";

import { loggerOptions } from "@/server/logging/logger";

function captureLogger() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { logger: pino(loggerOptions, destination), lastEntry: () => JSON.parse(lines.at(-1)!) };
}

describe("logger", () => {
  it("records message, stack and cause for errors logged as { error }", () => {
    const { logger, lastEntry } = captureLogger();

    logger.error({ error: new Error("outer", { cause: new Error("inner reason") }) }, "failed");

    const { error } = lastEntry();
    expect(error.message).toBe("outer");
    expect(error.stack).toEqual(expect.any(String));
    expect(error.cause.message).toBe("inner reason");
  });

  it("redacts secrets", () => {
    const { logger, lastEntry } = captureLogger();

    logger.info({ password: "hunter2", provider: { apiKey: "sk-secret" } }, "event");

    expect(lastEntry()).toMatchObject({ password: "[REDACTED]", provider: { apiKey: "[REDACTED]" } });
  });
});
