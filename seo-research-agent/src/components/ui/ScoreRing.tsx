const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A 0–100 score as a circular gauge. SVG attributes only, so it is CSP-safe. */
export function ScoreRing({ value, label, tone }: { value: number; label: string; tone: "good" | "warn" | "bad" }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const color = tone === "good" ? "stroke-emerald-500" : tone === "warn" ? "stroke-amber-500" : "stroke-rose-500";
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`${label}: ${clamped} out of 100`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={RADIUS} fill="none" strokeWidth="7" className="stroke-slate-100" />
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          className={color}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-slate-950">{clamped}</span>
        <span className="text-[10px] text-slate-500">/100</span>
      </span>
    </div>
  );
}
