import { afterEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: signOutMock }));

import { ApiError, apiRequest, errorMessage } from "@/lib/api-client";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function respond(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe("API client", () => {
  it("sends JSON with no caching and returns the parsed body", async () => {
    respond({ ok: true });

    await expect(apiRequest("/api/thing", { method: "POST", body: "{}" })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("/api/thing", expect.objectContaining({
      cache: "no-store",
      headers: { "content-type": "application/json" },
    }));
  });

  it("surfaces the server's message and status", async () => {
    respond({ error: { message: "Project not found." } }, 404);

    const error = await apiRequest("/api/thing").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Project not found.", status: 404, retryable: false });
  });

  it("uses a generic message when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));

    const error = await apiRequest("/api/thing").catch((caught: unknown) => caught);
    expect(error).toMatchObject({ message: "Something went wrong. Try again.", retryable: true });
  });

  it("marks network failures as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await apiRequest("/api/thing").catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 0, retryable: true });
  });

  it("rethrows aborts untouched so callers can ignore them", async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    await expect(apiRequest("/api/thing", { signal: controller.signal })).rejects.toBe(abort);
  });

  it("signs out on an expired session", async () => {
    respond({}, 401);

    await expect(apiRequest("/api/thing")).rejects.toMatchObject({ status: 401 });
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
  });

  it.each([[408, true], [429, true], [500, true], [503, true], [400, false], [403, false], [409, false]])(
    "treats HTTP %i as retryable=%s",
    (status, retryable) => {
      expect(new ApiError("x", status).retryable).toBe(retryable);
    },
  );

  it("reads messages from any error", () => {
    expect(errorMessage(new Error("Specific"))).toBe("Specific");
    expect(errorMessage("nope")).toBe("Something went wrong. Try again.");
  });
});
