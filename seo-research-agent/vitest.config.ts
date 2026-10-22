import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/setup/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // PGlite and jsdom are intentionally resource-heavy; bounding workers
    // prevents CI contention from turning otherwise deterministic tests flaky.
    maxWorkers: 4,
    // jsdom UI tests can be starved by parallel PGlite boots; allow headroom.
    testTimeout: 15_000,
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/data/**"],
    },
  },
});
