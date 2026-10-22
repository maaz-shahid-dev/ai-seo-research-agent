import { afterEach } from "vitest";

// Views mirror state into the query string; start every browser test at a clean URL.
afterEach(() => {
  if (typeof window !== "undefined") window.history.replaceState(null, "", "/");
});
