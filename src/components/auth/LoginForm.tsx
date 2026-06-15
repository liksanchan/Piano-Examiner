"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { redirectAfterAuth } from "@/lib/auth/redirect-after-auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setWakingUp(false);

    const wakeTimer = window.setTimeout(() => setWakingUp(true), 4000);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Unable to sign in.",
        );
        setLoading(false);
        return;
      }

      redirectAfterAuth(redirect);
    } catch {
      setError("Network error — the server may still be waking up. Wait a moment and try again.");
      setLoading(false);
    } finally {
      window.clearTimeout(wakeTimer);
      setWakingUp(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder:text-stone-400 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-700/20"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder:text-stone-400 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-700/20"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {wakingUp && (
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900" role="status">
          Server is waking up — on the free tier this can take up to a minute. Please keep
          waiting…
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (wakingUp ? "Waking up server…" : "Signing in…") : "Sign in"}
      </button>

      <p className="text-center text-sm text-stone-600">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-amber-800 hover:text-amber-900">
          Create one
        </Link>
      </p>
    </form>
  );
}
