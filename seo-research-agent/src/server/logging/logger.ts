import "server-only";

import pino from "pino";

const redactPaths = [
  "authorization",
  "cookie",
  "password",
  "passwordHash",
  "token",
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.apiKey",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "seo-research-agent",
    environment: process.env.NODE_ENV ?? "development",
  },
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
});
