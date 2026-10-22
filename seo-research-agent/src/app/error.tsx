"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

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
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-950">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">Please try again in a moment.</p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-slate-400">Ref: {error.digest}</p> : null}
        <Button className="mt-5" onClick={retry}>Try again</Button>
      </div>
    </main>
  );
}
