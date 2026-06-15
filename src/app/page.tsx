import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

const features = [
  {
    title: "Upload reference audio",
    description: "Add a recording of each piece for the AI to compare against.",
  },
  {
    title: "Record live",
    description: "Use your device microphone while listening to the reference track.",
  },
  {
    title: "Examiner feedback",
    description: "Get structured scores and comments in ABRSM or Trinity mode.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-stone-200 bg-gradient-to-b from-amber-50/80 to-stone-50 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-amber-800">
            AI Piano Examiner
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            Practice with feedback worthy of a real examiner
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
            Upload a reference recording, record your performance, and receive detailed
            scoring on tempo, dynamics, accuracy, and expression — all running
            locally on your laptop.
          </p>

          <div className="mt-10">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-lg bg-amber-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-900"
              >
                Go to dashboard
              </Link>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-lg bg-amber-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-900"
                >
                  Get started free
                </a>
                <a
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
                >
                  Sign in
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-sm font-medium uppercase tracking-widest text-stone-500">
          How it works
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <h3 className="font-semibold text-stone-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
