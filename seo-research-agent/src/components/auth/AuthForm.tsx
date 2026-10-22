"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthForm({ mode }: AuthFormProps) {
  const isRegistration = mode === "sign-up";
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "");
    const password = String(fields.get("password") ?? "");

    setPending(true);
    setMessage(null);

    try {
      if (isRegistration) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: String(fields.get("name") ?? ""), email, password }),
        });

        if (!response.ok) {
          setMessage(registrationFailureMessage(response.status));
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: "/",
      });

      // Auth.js answers rejected credentials with HTTP 200 and an `error`, so `ok` alone isn't enough.
      if (!result.ok || result.error) {
        setMessage(
          result.code === "try_again_later"
            ? "Sign-in is temporarily unavailable. Try again shortly."
            : "Email or password is incorrect.",
        );
        return;
      }

      window.location.assign(result.url ?? "/");
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-slate-900">SEO Research</p>
          <p className="text-xs text-slate-500">Find niches you can actually rank for</p>
        </div>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-950">
            {isRegistration ? "Create your account" : "Sign in"}
          </h1>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} onInput={() => setMessage(null)}>
            {isRegistration ? (
              <TextField label="Name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={80} />
            ) : null}
            <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} spellCheck={false} />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete={isRegistration ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={128}
              hint={isRegistration ? "At least 12 characters." : undefined}
            />

            {message ? (
              <p className="text-sm text-rose-700" role="alert">
                {message}
              </p>
            ) : null}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Please wait…" : isRegistration ? "Create account" : "Sign in"}
            </Button>
          </form>
        </section>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isRegistration ? "Already have an account?" : "New here?"}{" "}
          <Link
            href={isRegistration ? "/sign-in" : "/sign-up"}
            className="font-semibold text-indigo-700 hover:text-indigo-800"
          >
            {isRegistration ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}

function registrationFailureMessage(status: number) {
  if (status === 429) return "Too many attempts. Try again later.";
  if (status >= 500) return "Sign-up is temporarily unavailable. Try again shortly.";
  return "We couldn't create this account. Check your details, or sign in if you already have one.";
}
