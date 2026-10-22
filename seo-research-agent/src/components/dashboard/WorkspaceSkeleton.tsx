/** Placeholder shown while the workspace loads; mirrors the header and search bar. */
export function WorkspaceSkeleton() {
  return (
    <div className="min-h-dvh bg-slate-50" role="status" aria-busy="true">
      <div className="h-14 border-b border-slate-200 bg-white" />
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 px-4 py-6 motion-reduce:animate-none sm:px-6">
        <div className="h-11 rounded-lg bg-slate-200" />
        <div className="h-64 rounded-xl bg-slate-200" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
