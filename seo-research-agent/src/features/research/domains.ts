/**
 * Two-label public suffixes common in search results. Not the full Public
 * Suffix List, but enough that "bbc.co.uk" is a site and "co.uk" is not.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "org.nz", "co.za", "org.za", "co.in", "org.in", "net.in",
  "co.jp", "or.jp", "ne.jp", "co.kr", "or.kr", "co.id", "co.il", "co.th",
  "com.br", "com.mx", "com.ar", "com.co", "com.pe", "com.tr", "com.cn",
  "com.hk", "com.tw", "com.sg", "com.my", "com.pk", "com.ph", "com.vn",
  "com.sa", "com.eg", "com.ng", "com.bd", "com.ua",
]);

/** Lowercase hostname without "www.", or null when it isn't a plausible domain. */
export function normalizeHostname(value: string) {
  const host = value.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

/** "en.wikipedia.org" → "wikipedia.org", "news.bbc.co.uk" → "bbc.co.uk". */
export function registrableDomain(hostname: string) {
  const host = normalizeHostname(hostname);
  if (!host) return null;
  const labels = host.split(".");
  const suffixLength = labels.length >= 3 && MULTI_LABEL_SUFFIXES.has(labels.slice(-2).join(".")) ? 2 : 1;
  return labels.slice(-(suffixLength + 1)).join(".");
}

/**
 * A ranking homepage on a site's own domain ("dedicated niche site"), as
 * opposed to an article on a big portal or a page on a subdomain platform.
 */
export function isHomepageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = normalizeHostname(parsed.hostname);
    return host !== null && host === registrableDomain(host) && (parsed.pathname === "/" || parsed.pathname === "") && !parsed.search;
  } catch {
    return false;
  }
}
