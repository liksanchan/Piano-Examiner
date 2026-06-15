import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — Piano Examiner",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-800 text-xs font-bold text-white">
              ♪
            </span>
            <span className="font-medium">Piano Examiner</span>
          </Link>
          <h1 className="mt-6 text-2xl font-semibold text-stone-900">Welcome back</h1>
          <p className="mt-2 text-sm text-stone-600">
            Sign in to access your songs and performance history.
          </p>
          <p className="mt-3 text-xs text-stone-500">
            On the hosted free tier, the app sleeps when idle — the first sign-in after a
            break can take 30–60 seconds.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-stone-100" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
