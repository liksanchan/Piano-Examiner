"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-lg border border-stone-300 px-3.5 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
    >
      Sign out
    </button>
  );
}
