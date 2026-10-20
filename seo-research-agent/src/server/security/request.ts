export function isSameOriginMutation(request: Request, trustedOrigins: readonly string[] = []) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin || trustedOrigins.includes(origin);
}

export function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  return address && address.length <= 64 ? address : "unknown";
}
