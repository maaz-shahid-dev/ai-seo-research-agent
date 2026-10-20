'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-lg sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">The dashboard could not render</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your saved browser data has not been changed. Try rendering the dashboard again.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={retry}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </main>
  );
}
