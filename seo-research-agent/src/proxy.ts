import { NextRequest, NextResponse } from "next/server";

import { createSecurityHeaders } from "@/server/security/headers";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const headers = createSecurityHeaders(process.env.NODE_ENV === "production", nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  for (const header of headers) requestHeaders.set(header.key, header.value);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const header of headers) response.headers.set(header.key, header.value);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
