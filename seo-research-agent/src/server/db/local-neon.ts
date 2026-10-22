import type { neonConfig as NeonConfig } from "@neondatabase/serverless";

/** Hostname used by the docker-compose Neon proxy; it resolves to 127.0.0.1 via public DNS. */
export const LOCAL_NEON_HOST = "db.localtest.me";
const LOCAL_PROXY_PORT = 4444;

/**
 * Points the Neon driver at the local docker-compose proxy when DATABASE_URL
 * uses LOCAL_NEON_HOST. Production never takes this path, and real Neon URLs
 * leave the driver untouched. Returns whether the local proxy was configured.
 */
export function configureLocalNeonProxy(
  config: typeof NeonConfig,
  connectionString: string,
  nodeEnv = process.env.NODE_ENV,
) {
  if (nodeEnv === "production" || new URL(connectionString).hostname !== LOCAL_NEON_HOST) {
    return false;
  }

  config.fetchEndpoint = (host) => `http://${host}:${LOCAL_PROXY_PORT}/sql`;
  config.wsProxy = (host) => `${host}:${LOCAL_PROXY_PORT}/v2`;
  config.useSecureWebSocket = false;
  config.pipelineTLS = false;
  config.pipelineConnect = false;
  return true;
}
