"use client";

import { Lightbulb, Loader2, Search } from "lucide-react";

import type { NicheIdeasResponse } from "@/features/research/types";
import { Button } from "@/components/ui/Button";
import { usePolling } from "@/hooks/usePolling";
import { apiRequest } from "@/lib/api-client";

const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** Fresh, specific niche ideas each morning; one click checks a niche. */
export function DailyNichesView({ onCheck }: { onCheck: (seed: string) => void }) {
  const { data, error } = usePolling(
    "/api/niche-ideas",
    (signal) => apiRequest<NicheIdeasResponse>("/api/niche-ideas", { signal }),
    () => null,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
          <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
          Daily niches
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {data?.date ? `Ideas for ${dateFormat.format(new Date(`${data.date}T00:00:00Z`))}. ` : ""}
          Specific, problem-solving micro niches. Risky topics (gambling, adult, piracy, YMYL) are never suggested.
        </p>
      </div>

      {error && !data ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
      {!data && !error ? (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" /> Loading today’s ideas…
        </p>
      ) : null}
      {data && data.ideas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          New ideas appear every morning. Check back tomorrow.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {data?.ideas.map((idea) => (
          <li key={idea.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">{idea.niche}</p>
            <p className="mt-1 text-sm text-slate-600">{idea.problem}</p>
            <p className="mt-2 text-xs text-slate-500">For {idea.audience}</p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <code className="truncate rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{idea.seedKeyword}</code>
              <Button size="sm" variant="secondary" onClick={() => onCheck(idea.seedKeyword)}>
                <Search className="h-4 w-4" aria-hidden="true" /> Check niche
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
