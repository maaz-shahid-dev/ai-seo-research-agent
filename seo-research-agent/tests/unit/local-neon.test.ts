import type { neonConfig } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { configureLocalNeonProxy } from "@/server/db/local-neon";

const localUrl = "postgres://postgres:postgres@db.localtest.me:5432/main";

function blankConfig() {
  return {} as typeof neonConfig;
}

describe("local Neon proxy configuration", () => {
  it("routes HTTP and WebSocket traffic to the docker-compose proxy", () => {
    const config = blankConfig();

    expect(configureLocalNeonProxy(config, localUrl, "development")).toBe(true);
    expect((config.fetchEndpoint as (host: string) => string)("db.localtest.me"))
      .toBe("http://db.localtest.me:4444/sql");
    expect((config.wsProxy as (host: string) => string)("db.localtest.me")).toBe("db.localtest.me:4444/v2");
    expect(config.useSecureWebSocket).toBe(false);
  });

  it("never changes the driver in production or for real Neon hosts", () => {
    const production = blankConfig();
    const remote = blankConfig();

    expect(configureLocalNeonProxy(production, localUrl, "production")).toBe(false);
    expect(configureLocalNeonProxy(remote, "postgres://u:p@ep-x.neon.tech/db", "development")).toBe(false);
    expect(production).toEqual({});
    expect(remote).toEqual({});
  });
});
