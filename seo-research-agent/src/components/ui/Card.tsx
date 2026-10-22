import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** Rendered element; sections get a heading via aria-labelledby. */
  as?: "div" | "section" | "article";
  padded?: boolean;
};

/** The standard surface: white card, slate border, rounded corners. */
export function Card({ as: Element = "div", padded = true, className = "", ...props }: CardProps) {
  return <Element className={`rounded-xl border border-slate-200 bg-white ${padded ? "p-4 sm:p-5" : ""} ${className}`.trim()} {...props} />;
}

/** One headline number with an optional detail line. */
export function StatCard({ label, value, detail, compact = false }: { label: string; value: ReactNode; detail?: ReactNode; compact?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 font-semibold text-slate-900 ${compact ? "truncate text-sm" : "text-xl tabular-nums"}`}>{value}</dd>
      {detail ? <dd className="mt-0.5 truncate text-xs text-slate-500">{detail}</dd> : null}
    </div>
  );
}
