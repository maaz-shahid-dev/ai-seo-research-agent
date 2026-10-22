"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

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
    const confirmPassword = String(fields.get("confirmPassword") ?? "");

    if (isRegistration && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      if (isRegistration) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: String(fields.get("name") ?? ""),
            email,
            password,
          }),
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

      if (!result.ok) {
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
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="text-sm font-semibold text-indigo-700">
          SEO Research Agent
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
          {isRegistration ? "Create account" : "Sign in"}
        </h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} onInput={() => setMessage(null)}>
          {isRegistration ? (
            <Field label="Name" name="name" type="text" autoComplete="name" minLength={2} maxLength={80} />
          ) : null}
          <Field label="Email" name="email" type="email" autoComplete="email" maxLength={254} />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={isRegistration ? "new-password" : "current-password"}
            minLength={12}
            maxLength={128}
          />
          {isRegistration ? (
            <Field
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
            />
          ) : null}

          {message ? (
            <p className="text-sm text-red-700" role="alert" aria-live="polite">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Please wait…" : isRegistration ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isRegistration ? "Already have an account?" : "New here?"}{" "}
          <Link
            href={isRegistration ? "/sign-in" : "/sign-up"}
            className="font-semibold text-indigo-700 hover:text-indigo-800"
          >
            {isRegistration ? "Sign in" : "Create account"}
          </Link>
        </p>
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  minLength?: number;
  maxLength: number;
};

function Field({ label, ...inputProps }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        {...inputProps}
        required
        spellCheck={false}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 shadow-sm placeholder:text-slate-400"
      />
    </label>
  );
}

function registrationFailureMessage(status: number) {
  if (status === 429) return "Too many attempts. Try again later.";
  if (status >= 500) return "Account creation is temporarily unavailable.";
  return "We could not create this account. Check the details or sign in.";
}
