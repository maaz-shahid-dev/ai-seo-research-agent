// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsView } from "@/components/dashboard/SettingsView";
import type { SettingsDto } from "@/features/settings/schemas";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const settings: SettingsDto = { email: "maaz@example.test", displayName: "Maaz", defaultCountryCode: null, theme: "light", tableDensity: "comfortable" };

describe("settings screen", () => {
  it("saves only changed fields and hands the result back", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify({ settings: { ...settings, ...JSON.parse(String(init!.body)) } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<SettingsView settings={settings} onSaved={onSaved} />);

    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect((screen.getByLabelText("Email") as HTMLInputElement).readOnly).toBe(true);

    await user.selectOptions(screen.getByLabelText("Default country"), "PK");
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.click(screen.getByRole("radio", { name: "Compact" }));
    await user.click(save);

    expect(fetchMock).toHaveBeenCalledWith("/api/me/settings", expect.objectContaining({ method: "PATCH" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ defaultCountryCode: "PK", theme: "dark", tableDensity: "compact" });
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark", tableDensity: "compact", defaultCountryCode: "PK" }));
  });

  it("shows server validation errors and keeps the edits", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Use letters, numbers, spaces, apostrophes, periods, or hyphens." } }), { status: 400 })));
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<SettingsView settings={settings} onSaved={onSaved} />);

    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Maaz <b>");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Use letters");
    expect((name as HTMLInputElement).value).toBe("Maaz <b>");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
