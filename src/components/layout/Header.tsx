import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/SignOutButton";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-800 text-sm font-bold text-white">
            ♪
          </span>
          <span className="text-lg font-semibold tracking-tight text-stone-900">
            Piano Examiner
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden text-sm font-medium text-stone-600 hover:text-stone-900 sm:inline"
              >
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-stone-600 hover:text-stone-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-amber-800 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-900"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
