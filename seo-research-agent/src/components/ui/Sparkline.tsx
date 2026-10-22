type SparklineProps = {
  values: readonly number[];
  label: string;
  width?: number;
  height?: number;
};

/** Tiny trend line. SVG attributes only, so it is safe under the strict CSP. */
export function Sparkline({ values, label, width = 64, height = 20 }: SparklineProps) {
  if (values.length < 2) return <span className="text-slate-500">—</span>;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - 2 - ((value - min) / range) * (height - 4)).toFixed(1)}`)
    .join(" ");

  return (
    <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-500" />
    </svg>
  );
}

/** Describes the direction of a series by comparing its first and last thirds. */
export function describeTrend(values: readonly number[]) {
  if (values.length < 2) return "No trend data";
  const third = Math.max(1, Math.floor(values.length / 3));
  const average = (slice: readonly number[]) => slice.reduce((sum, value) => sum + value, 0) / slice.length;
  const start = average(values.slice(0, third));
  const end = average(values.slice(-third));
  if (start === 0) return end > 0 ? "Trend: rising" : "Trend: stable";
  const change = (end - start) / start;
  return change > 0.1 ? "Trend: rising" : change < -0.1 ? "Trend: falling" : "Trend: stable";
}
