import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { performances, pieces } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const performance = await db.query.performances.findFirst({
    where: and(
      eq(performances.id, id),
      eq(performances.userId, session.userId),
    ),
  });

  if (!performance) {
    return NextResponse.json({ error: "Performance not found." }, { status: 404 });
  }

  const piece = await db.query.pieces.findFirst({
    where: eq(pieces.id, performance.pieceId),
  });

  return NextResponse.json({ performance, piece });
}
