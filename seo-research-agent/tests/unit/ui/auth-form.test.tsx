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
    const user = userEvent.setup({ delay: null });
    signInMock.mockResolvedValue({ ok: true, status: 200, error: "CredentialsSignin", code: "credentials", url: null });
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
    expect((await screen.findByRole("alert")).textContent).toContain("Email or password is incorrect.");
  });

  it("states the password rule on sign-up and enforces it in the field", () => {
    render(<AuthForm mode="sign-up" />);

    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("minlength")).toBe("12");
    expect(password.getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getByText("At least 12 characters.").id).toBe(password.getAttribute("aria-describedby"));
  });

  it.each([
    [409, "We couldn't create this account. Check your details, or sign in if you already have one."],
    [429, "Too many attempts. Try again later."],
    [503, "Sign-up is temporarily unavailable. Try again shortly."],
  ])("explains a %i registration failure without signing in", async (status, message) => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    render(<AuthForm mode="sign-up" />);

    await user.type(screen.getByLabelText("Name"), "Person Example");
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("registers only allowed fields before signing in", async () => {
    const user = userEvent.setup({ delay: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    signInMock.mockResolvedValue({ ok: true, status: 200, error: "CredentialsSignin", code: "credentials", url: null });
    render(<AuthForm mode="sign-up" />);

    await user.type(screen.getByLabelText("Name"), "Person Example");
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
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

describe("authentication form outcomes", () => {
  async function signInWith(result: unknown) {
    const user = userEvent.setup({ delay: null });
    signInMock.mockResolvedValue(result);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<AuthForm mode="sign-in" />);
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    return assign;
  }

  it("reports a temporary outage that Auth.js returns with HTTP 200", async () => {
    const assign = await signInWith({ ok: true, status: 200, error: "CredentialsSignin", code: "try_again_later", url: null });

    expect((await screen.findByRole("alert")).textContent).toBe("Sign-in is temporarily unavailable. Try again shortly.");
    expect(assign).not.toHaveBeenCalled();
  });

  it("navigates only after a successful sign-in", async () => {
    const assign = await signInWith({ ok: true, status: 200, error: undefined, code: undefined, url: "http://localhost/" });

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("http://localhost/"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
