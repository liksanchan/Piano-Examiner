import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = {
  title: "Create account — Piano Examiner",
};

export default function SignupPage() {
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
          <h1 className="mt-6 text-2xl font-semibold text-stone-900">Create your account</h1>
          <p className="mt-2 text-sm text-stone-600">
            Save your progress, songs, and examiner feedback.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
