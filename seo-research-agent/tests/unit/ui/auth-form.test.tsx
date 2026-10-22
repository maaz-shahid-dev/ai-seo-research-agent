// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/AuthForm";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("authentication form", () => {
  it("submits credentials and shows the same message for invalid sign-in", async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({ ok: false, code: "credentials", url: null });
    render(<AuthForm mode="sign-in" />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "incorrect password value");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "person@example.com",
      password: "incorrect password value",
      redirect: false,
      redirectTo: "/",
    });
    expect(screen.getByRole("alert").textContent).toContain("Email or password is incorrect.");
  });

  it("does not send registration when password confirmation differs", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm mode="sign-up" />);

    await user.type(screen.getByLabelText("Name"), "Person Example");
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.type(screen.getByLabelText("Confirm password"), "different password value");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(signInMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Passwords do not match.");
  });

  it("registers only allowed fields before signing in", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    signInMock.mockResolvedValue({ ok: false, code: "credentials", url: null });
    render(<AuthForm mode="sign-up" />);

    await user.type(screen.getByLabelText("Name"), "Person Example");
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.type(screen.getByLabelText("Confirm password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Person Example",
      email: "person@example.com",
      password: "correct horse battery staple",
    });
    expect(String(init.body)).not.toContain("role");
    expect(signInMock).toHaveBeenCalledOnce();
  });
});
