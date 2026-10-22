"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { updateProject } from "@/features/projects/client";
import { isJobInProgress, type ContentGapDto, type ProjectDto } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { usePolling } from "@/hooks/usePolling";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { formatCurrencyMicros, formatNumber } from "@/lib/format";

const POLL_MS = 2_500;

type ContentGapViewProps = {
  runId: string;
  project: ProjectDto;
  onProjectUpdate: (project: ProjectDto) => void;
};

/** Keywords the top competitors for this topic rank for, but the project's site doesn't. */
export function ContentGapView({ runId, project, onProjectUpdate }: ContentGapViewProps) {
  if (!project.targetDomain) return <WebsiteForm project={project} onSaved={onProjectUpdate} />;
  return <ContentGapReport runId={runId} targetDomain={project.targetDomain} />;
}

function ContentGapReport({ runId, targetDomain }: { runId: string; targetDomain: string }) {
  const url = `/api/research/${runId}/content-gap`;
  // Keyed by domain too, so changing the website requests a fresh report.
  const { data: gap, error } = usePolling(
    `${url}?domain=${targetDomain}`,
    async (signal, attempt) => {
      const { contentGap } = await apiRequest<{ contentGap: ContentGapDto }>(
        url,
        attempt === 0 ? { method: "POST", body: "{}", signal } : { signal },
      );
      return contentGap;
    },
    (report) => (isJobInProgress(report) ? POLL_MS : null),
  );

  if (error && !gap) return <p className="text-sm text-amber-700" role="status">{error}</p>;
  if (!gap || isJobInProgress(gap)) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-slate-600" role="status">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
        Comparing {targetDomain} with top competitors…
      </p>
    );
  }
  if (gap.status === "failed") {
    return <p className="text-sm text-rose-700" role="alert">{gap.errorMessage ?? "Content gap analysis failed."}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Keywords competitors rank for that <strong className="font-semibold text-slate-900">{gap.targetDomain}</strong> doesn&apos;t.
        {gap.competitors.length > 0 ? <> Compared with {gap.competitors.join(", ")}.</> : null}
      </p>
      <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Keyword</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Volume</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Difficulty</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">CPC</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Competitor ranking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gap.keywords.map((item) => (
              <tr key={item.keyword}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{item.keyword}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(item.searchVolume)}</td>
                <td className="px-4 py-2.5 text-right">
                  {item.difficulty === null ? <span className="text-slate-400">—</span> : <Badge tone={difficultyTone(item.difficulty)}>{item.difficulty}</Badge>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyMicros(item.cpcMicros)}</td>
                <td className="px-4 py-2.5 text-slate-600">{item.competitorDomain} <span className="text-slate-400">#{item.competitorRank}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {gap.keywords.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">No gaps found. Your site already covers what competitors rank for.</p>
        ) : null}
      </div>
    </div>
  );
}

function WebsiteForm({ project, onSaved }: { project: ProjectDto; onSaved: (project: ProjectDto) => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetDomain = String(new FormData(event.currentTarget).get("targetDomain") ?? "");
    setPending(true);
    setMessage(null);
    try {
      onSaved(await updateProject(project, { targetDomain }));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-3 py-2">
      <p className="text-sm text-slate-600">Add your website to see keywords your competitors rank for and you don&apos;t.</p>
      <div className="flex gap-2">
        <TextField label="Your website" hideLabel name="targetDomain" placeholder="example.com" required maxLength={253} className="flex-1" />
        <Button type="submit" disabled={pending}>Find gaps</Button>
      </div>
      {message ? <p className="text-sm text-rose-700" role="alert">{message}</p> : null}
    </form>
  );
}
