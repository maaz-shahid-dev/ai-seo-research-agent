import { ArrowRight, CircleDot, Layers3, Target } from 'lucide-react';
import type { KeywordResult, SearchIntent } from '@/types/seo';

interface ContentCoverageViewProps {
  keywords: KeywordResult[];
  onOpenKeywordResearch: () => void;
}

interface ClusterSummary {
  name: string;
  keywords: KeywordResult[];
  volume: number;
  averageDifficulty: number | null;
}

const INTENTS: SearchIntent[] = [
  'Informational',
  'Commercial',
  'Transactional',
  'Navigational',
];

export function ContentCoverageView({
  keywords,
  onOpenKeywordResearch,
}: ContentCoverageViewProps) {
  const clusterMap = new Map<string, KeywordResult[]>();

  for (const keyword of keywords) {
    const cluster = keyword.cluster ?? 'Unclustered';
    clusterMap.set(cluster, [...(clusterMap.get(cluster) ?? []), keyword]);
  }

  const clusters: ClusterSummary[] = [...clusterMap.entries()]
    .map(([name, clusterKeywords]) => {
      const measuredDifficulty = clusterKeywords
        .map((keyword) => keyword.keyword_difficulty)
        .filter((difficulty): difficulty is number => difficulty !== null);

      return {
        name,
        keywords: clusterKeywords,
        volume: clusterKeywords.reduce(
          (sum, keyword) => sum + (keyword.search_volume ?? 0),
          0
        ),
        averageDifficulty: measuredDifficulty.length
          ? Math.round(
              measuredDifficulty.reduce((sum, difficulty) => sum + difficulty, 0) /
                measuredDifficulty.length
            )
          : null,
      };
    })
    .sort((first, second) => second.volume - first.volume);

  const measuredDifficulty = keywords.filter(
    (keyword) => keyword.keyword_difficulty !== null
  );
  const lowDifficultyCount = measuredDifficulty.filter(
    (keyword) => (keyword.keyword_difficulty ?? 100) < 30
  ).length;
  const representedIntents = new Set(
    keywords
      .map((keyword) => keyword.intent)
      .filter((intent): intent is SearchIntent => intent !== null)
  );
  const coverageScore = keywords.length
    ? Math.round(
        Math.min(clusters.length / 6, 1) * 40 +
          Math.min(representedIntents.size / INTENTS.length, 1) * 30 +
          (measuredDifficulty.length ? lowDifficultyCount / measuredDifficulty.length : 0) * 30
      )
    : 0;

  if (keywords.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Layers3 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">No content map is available</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
          Content coverage is derived from the loaded keyword snapshot. Run the bundled demo query or load a saved snapshot first.
        </p>
        <button
          type="button"
          onClick={onOpenKeywordResearch}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Open keyword research
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Content coverage map
            </h1>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-800">
              Derived from demo evidence
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            See how the loaded keywords cover topics and search intent. This view uses only the current snapshot; it does not estimate traffic or rankings.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenKeywordResearch}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Review keywords
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-700 to-slate-900 p-5 text-white shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-200">
                Coverage indicator
              </span>
              <div className="mt-2 flex items-end gap-2">
                <strong className="text-4xl font-black tracking-tight">{coverageScore}</strong>
                <span className="pb-1 text-sm font-semibold text-indigo-200">/ 100</span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100">
                A transparent demo score based on cluster breadth (40%), intent breadth (30%), and the share of measured keywords below KD 30 (30%).
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[290px]">
              <CoverageStat label="Clusters" value={clusters.length} />
              <CoverageStat label="Intents" value={representedIntents.size} />
              <CoverageStat label="Low KD" value={lowDifficultyCount} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Intent coverage</h2>
          </div>
          <div className="mt-4 space-y-3">
            {INTENTS.map((intent) => {
              const count = keywords.filter((keyword) => keyword.intent === intent).length;
              const percentage = Math.round((count / keywords.length) * 100);
              return (
                <div key={intent}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{intent}</span>
                    <span className="font-mono text-slate-500">{count} · {percentage}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Topical clusters</h2>
            <p className="mt-0.5 text-xs text-slate-500">Counts and totals are calculated from the loaded rows.</p>
          </div>
          <span className="text-xs font-medium text-slate-500">{keywords.length} keywords mapped</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {clusters.map((cluster) => (
            <article key={cluster.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <CircleDot className="h-4 w-4 shrink-0" />
                    <h3 className="truncate text-sm font-bold text-slate-900">{cluster.name}</h3>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {cluster.keywords.length} keywords · {cluster.volume.toLocaleString()} measured monthly volume
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
                  {cluster.averageDifficulty === null ? 'KD N/A' : `KD ${cluster.averageDifficulty}`}
                </span>
              </div>
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                {[...cluster.keywords]
                  .sort((first, second) => (second.search_volume ?? -1) - (first.search_volume ?? -1))
                  .slice(0, 3)
                  .map((keyword) => (
                    <li key={keyword.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-700">{keyword.keyword}</span>
                      <span className="shrink-0 font-mono text-slate-500">
                        {keyword.search_volume?.toLocaleString() ?? 'N/A'}
                      </span>
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CoverageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-3 backdrop-blur-sm">
      <strong className="block text-lg font-bold text-white">{value}</strong>
      <span className="text-[11px] font-medium text-indigo-200">{label}</span>
    </div>
  );
}
