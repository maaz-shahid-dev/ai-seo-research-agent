import { authorityBuckets, siteTypeBreakdown } from "@/features/research/serp-insights";
import type { SerpResultDto } from "@/features/research/types";

const CHART_HEIGHT = 80;
const BAR_WIDTH = 36;
const GAP = 12;

/** Authority spread and kinds of sites on page 1, as small SVG charts with text alternatives. */
export function SerpInsights({ results }: { results: readonly SerpResultDto[] }) {
  if (results.length === 0) return null;
  const { buckets, unknown } = authorityBuckets(results);
  const types = siteTypeBreakdown(results);
  const tallest = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const width = buckets.length * (BAR_WIDTH + GAP) - GAP;
  const summary = buckets.map((bucket) => `${bucket.count} with authority ${bucket.label}`).join(", ")
    + (unknown ? `, ${unknown} unknown` : "");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <figure className="rounded-xl border border-slate-200 p-4">
        <figcaption className="text-sm font-semibold text-slate-900">Authority (DR) spread</figcaption>
        <svg viewBox={`0 0 ${width} ${CHART_HEIGHT + 18}`} className="mt-3 h-28 w-full" role="img" aria-label={`Top 10 results: ${summary}.`}>
          {buckets.map((bucket, index) => {
            const height = bucket.count === 0 ? 2 : (bucket.count / tallest) * CHART_HEIGHT;
            const x = index * (BAR_WIDTH + GAP);
            return (
              <g key={bucket.label}>
                <rect
                  x={x}
                  y={CHART_HEIGHT - height}
                  width={BAR_WIDTH}
                  height={height}
                  rx={3}
                  className={bucket.easy ? "fill-emerald-500" : "fill-slate-300"}
                />
                <text x={x + BAR_WIDTH / 2} y={CHART_HEIGHT - height - 4} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
                  {bucket.count || ""}
                </text>
                <text x={x + BAR_WIDTH / 2} y={CHART_HEIGHT + 14} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {bucket.label}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="mt-1 text-xs text-slate-500">
          Green: DR 20 or less, realistic for a new site.{unknown ? ` ${unknown} without authority data.` : ""}
        </p>
      </figure>

      <figure className="rounded-xl border border-slate-200 p-4">
        <figcaption className="text-sm font-semibold text-slate-900">Kinds of sites</figcaption>
        <ul className="mt-3 space-y-2">
          {types.map((type) => (
            <li key={type.type} className="text-xs">
              <div className="flex justify-between text-slate-700">
                <span>{type.label}</span>
                <span className="tabular-nums">{type.count} of {results.length}</span>
              </div>
              <progress
                value={type.count}
                max={results.length}
                aria-hidden="true"
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-indigo-500 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-indigo-500"
              />
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}
