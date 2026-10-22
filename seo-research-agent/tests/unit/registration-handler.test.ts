import { describe, expect, it, vi } from "vitest";

import { handleRegistrationRequest } from "@/features/auth/registration-handler";
import { AppError } from "@/server/http/errors";

const account = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "person@example.com",
  displayName: "Person Example",
  role: "user" as const,
  status: "active" as const,
  sessionVersion: 0,
};

function registrationRequest(
  body = JSON.stringify({
    name: "Person Example",
    email: "person@example.com",
    password: "correct horse battery staple",
  }),
  headers: Record<string, string> = {},
) {
  return new Request("https://app.example.test/api/auth/register", {
    method: "POST",
    headers: {
      origin: "https://app.example.test",
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.20, 10.0.0.1",
      ...headers,
    },
    body,
  });
}

describe("registration HTTP boundary", () => {
  it("accepts a bounded same-origin JSON request without returning account data", async () => {
    const register = vi.fn().mockResolvedValue(account);
    const request = registrationRequest(undefined, { "x-request-id": "request-123" });
    const response = await handleRegistrationRequest(request, register);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(register).toHaveBeenCalledWith(
      {
        name: "Person Example",
        email: "person@example.com",
        password: "correct horse battery staple",
      },
      "203.0.113.20",
    );
  });

  it.each([
    ["missing origin", { origin: "" }],
    ["cross-site origin", { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }],
  ])("rejects a %s before reading or processing registration", async (_label, headers) => {
    const register = vi.fn().mockResolvedValue(account);
    const response = await handleRegistrationRequest(registrationRequest(undefined, headers), register);

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("INVALID_ORIGIN");
    expect(register).not.toHaveBeenCalled();
  });

  it("requires JSON content", async () => {
    const register = vi.fn().mockResolvedValue(account);
    const response = await handleRegistrationRequest(
      registrationRequest("name=Person", { "content-type": "application/x-www-form-urlencoded" }),
      register,
    );

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const register = vi.fn().mockResolvedValue(account);
    const response = await handleRegistrationRequest(registrationRequest("{"), register);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
    expect(register).not.toHaveBeenCalled();
  });

  it.each([
    ["declared", "{}", { "content-length": String(16 * 1024 + 1) }],
    ["streamed", JSON.stringify({ padding: "x".repeat(16 * 1024) }), {}],
  ])("rejects a %s oversized body", async (_label, body, headers) => {
    const register = vi.fn().mockResolvedValue(account);
    const response = await handleRegistrationRequest(registrationRequest(body, headers), register);

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(register).not.toHaveBeenCalled();
  });

  it("preserves safe operational errors and hides unexpected failures", async () => {
    const limited = vi
      .fn()
      .mockRejectedValueOnce(new AppError("Too many requests.", "RATE_LIMITED", 429, true));
    const limitedResponse = await handleRegistrationRequest(registrationRequest(), limited);
    expect(limitedResponse.status).toBe(429);
    expect(await limitedResponse.json()).toMatchObject({
      error: { code: "RATE_LIMITED", message: "Too many requests." },
    });

    const failed = vi.fn().mockRejectedValueOnce(new Error("database password: secret"));
    const failedResponse = await handleRegistrationRequest(registrationRequest(), failed);
    expect(failedResponse.status).toBe(500);
    const payload = await failedResponse.json();
    expect(payload.error.message).toBe("Something went wrong. Try again.");
    expect(JSON.stringify(payload)).not.toContain("secret");
  });
});
