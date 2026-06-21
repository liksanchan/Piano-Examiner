import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { performances, pieces } from "@/lib/db/schema";
import { ResultsView } from "@/components/results/ResultsView";

export async function generateMetadata() {
  return { title: "Results — Piano Examiner" };
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ performanceId: string }>;
}) {
  const user = await requireUser();

  const { performanceId } = await params;
  const db = getDb();

  const performance = await db.query.performances.findFirst({
    where: and(
      eq(performances.id, performanceId),
      eq(performances.userId, user.id),
    ),
  });

  if (!performance || performance.status !== "completed") {
    notFound();
  }

  const piece = await db.query.pieces.findFirst({
    where: eq(pieces.id, performance.pieceId),
  });

  if (!piece) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link
          href="/dashboard"
          className="font-medium text-amber-800 hover:text-amber-900"
        >
          ← Dashboard
        </Link>
        <Link
          href={`/practice/${piece.id}`}
          className="font-medium text-amber-800 hover:text-amber-900"
        >
          Back to practice
        </Link>
      </div>

      <div className="mt-6">
        <ResultsView performance={performance} piece={piece} />
      </div>
    </div>
  );
}
