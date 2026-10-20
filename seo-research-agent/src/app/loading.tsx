export default function Loading() {
  return (
    <main
      className="min-h-dvh bg-slate-50 p-5 sm:p-8"
      aria-label="Loading dashboard"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl animate-pulse space-y-5 motion-reduce:animate-none">
        <div className="h-8 w-64 rounded-lg bg-slate-200" />
        <div className="h-32 rounded-2xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-36 rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-200" />
      </div>
      <span className="sr-only">Loading the SEO research workspace…</span>
    </main>
  );
}
