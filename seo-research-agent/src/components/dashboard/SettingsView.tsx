"use client";

import { Loader2, Settings } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { MARKETS } from "@/features/research/markets";
import type { SettingsDto } from "@/features/settings/schemas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { apiRequest, errorMessage } from "@/lib/api-client";

type SettingsViewProps = {
  settings: SettingsDto;
  /** Called with the saved settings so the rest of the app can apply them. */
  onSaved: (settings: SettingsDto) => void;
};

const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

/** Profile and preferences, saved to the account so they follow the user to every device. */
export function SettingsView({ settings, onSaved }: SettingsViewProps) {
  // What the account holds now; the draft is compared against it.
  const [baseline, setBaseline] = useState(settings);
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changes = Object.fromEntries(
    (["displayName", "defaultCountryCode", "theme", "tableDensity"] as const)
      .filter((key) => draft[key] !== baseline[key])
      .map((key) => [key, key === "displayName" ? draft.displayName.trim() : draft[key]]),
  );
  const dirty = Object.keys(changes).length > 0;
  const update = (change: Partial<SettingsDto>) => {
    setDraft((current) => ({ ...current, ...change }));
    setSaved(false);
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiRequest<{ settings: SettingsDto }>("/api/me/settings", { method: "PATCH", body: JSON.stringify(changes) });
      setBaseline(result.settings);
      setDraft(result.settings);
      setSaved(true);
      onSaved(result.settings);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
          <Settings className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">Saved to your account, so they apply on every device.</p>
      </div>

      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <Card as="section" aria-labelledby="profile-title" className="space-y-4">
          <h2 id="profile-title" className="font-semibold text-slate-900">Profile</h2>
          <Field label="Name" htmlFor="settings-name">
            <input
              id="settings-name"
              value={draft.displayName}
              onChange={(event) => update({ displayName: event.target.value })}
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              className={inputClass}
            />
          </Field>
          <Field label="Email" htmlFor="settings-email" hint="Contact support to change your sign-in email.">
            <input id="settings-email" value={draft.email} readOnly className={`${inputClass} bg-slate-50 text-slate-500`} />
          </Field>
        </Card>

        <Card as="section" aria-labelledby="preferences-title" className="space-y-4">
          <h2 id="preferences-title" className="font-semibold text-slate-900">Preferences</h2>
          <Field label="Default country" htmlFor="settings-country" hint="New searches start in this market.">
            <select
              id="settings-country"
              value={draft.defaultCountryCode ?? ""}
              onChange={(event) => update({ defaultCountryCode: event.target.value || null })}
              className={inputClass}
            >
              <option value="">Use the project’s market</option>
              {MARKETS.map((market) => <option key={market.countryCode} value={market.countryCode}>{market.name}</option>)}
            </select>
          </Field>
          <Choice
            legend="Theme"
            name="theme"
            value={draft.theme}
            options={[["light", "Light"], ["dark", "Dark"]]}
            onChange={(theme) => update({ theme })}
          />
          <Choice
            legend="Table density"
            name="density"
            value={draft.tableDensity}
            options={[["comfortable", "Comfortable"], ["compact", "Compact"]]}
            onChange={(tableDensity) => update({ tableDensity })}
          />
        </Card>

        {error ? <ErrorState>{error}</ErrorState> : null}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save changes
          </Button>
          <p role="status" className="text-sm text-emerald-700">{saved && !dirty ? "Saved." : ""}</p>
        </div>
      </form>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-800">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Choice<T extends string>({ legend, name, value, options, onChange }: {
  legend: string;
  name: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      <div className="mt-1.5 flex gap-2">
        {options.map(([option, label]) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              value === option ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-700"
            }`}
          >
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="accent-indigo-600" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
