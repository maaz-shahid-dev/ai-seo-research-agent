import type { ReactNode } from "react";

export type BadgeTone = "good" | "warn" | "bad" | "neutral" | "accent";

const tones: Record<BadgeTone, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
  accent: "bg-indigo-50 text-indigo-700",
};

export function Badge({ tone, children, title }: { tone: BadgeTone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Low difficulty is good: green under 30, amber under 60, red above. */
export function difficultyTone(value: number): BadgeTone {
  return value < 30 ? "good" : value < 60 ? "warn" : "bad";
}

/** High niche score is good: green from 60, amber from 35, red below. */
export function nicheTone(value: number): BadgeTone {
  return value >= 60 ? "good" : value >= 35 ? "warn" : "bad";
}
