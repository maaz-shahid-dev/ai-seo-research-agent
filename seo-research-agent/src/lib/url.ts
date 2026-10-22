/** Returns the URL only if it is http(s), so provider data can't inject `javascript:` links. */
export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
