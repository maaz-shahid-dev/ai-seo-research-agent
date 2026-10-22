import type { NextConfig } from "next";
import { createSecurityHeaders } from "./src/server/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: createSecurityHeaders(process.env.NODE_ENV === "production")
          .filter(({ key }) => key !== "Content-Security-Policy"),
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
