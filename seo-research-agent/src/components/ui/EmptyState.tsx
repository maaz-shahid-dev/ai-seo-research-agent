import type { ReactNode } from "react";

/** A calm placeholder for "nothing here yet", with an optional action. */
export function EmptyState({ title, children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      {title ? <p className="font-semibold text-slate-900">{title}</p> : null}
      {children ? <p className={`text-sm text-slate-500 ${title ? "mt-1" : ""}`}>{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
