import { NextResponse } from "next/server";

import { eq, and } from "drizzle-orm";

import { getDb } from "@/lib/db";

import { performances, pieces } from "@/lib/db/schema";

import { getSession } from "@/lib/auth/session";

import { buildMockEvaluation } from "@/lib/evaluation/mock";

import { evaluatePerformance } from "@/lib/evaluation/pipeline";



export const maxDuration = 600;



function useMockEvaluation() {

  const mode = process.env.EVALUATION_MODE ?? "auto";

  return mode === "mock";

}



export async function POST(request: Request) {

  const session = await getSession();

  if (!session) {

    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  }



  let performanceId = "";



  try {

    const body = await request.json();

    performanceId = String(body.performanceId ?? "");



    if (!performanceId) {

      return NextResponse.json(

        { error: "performanceId is required." },

        { status: 400 },

      );

    }



    const db = getDb();

    const performance = await db.query.performances.findFirst({

      where: and(

        eq(performances.id, performanceId),

        eq(performances.userId, session.userId),

      ),

    });



    if (!performance) {

      return NextResponse.json(

        { error: "Performance not found." },

        { status: 404 },

      );

    }



    const piece = await db.query.pieces.findFirst({

      where: eq(pieces.id, performance.pieceId),

    });



    if (!piece || piece.userId !== session.userId) {

      return NextResponse.json({ error: "Piece not found." }, { status: 404 });

    }



    await db

      .update(performances)

      .set({ status: "processing", updatedAt: new Date().toISOString() })

      .where(eq(performances.id, performanceId));



    const result = useMockEvaluation()

      ? buildMockEvaluation(performance.examinerMode)

      : await evaluatePerformance(performance, piece);



    await db

      .update(performances)

      .set({

        status: "completed",

        totalScore: result.totalScore,

        maxScore: result.maxScore,

        scoreBreakdown: result.scoreBreakdown,

        feedback: result.feedback as unknown as Record<string, unknown>,

        updatedAt: new Date().toISOString(),

      })

      .where(eq(performances.id, performanceId));



    return NextResponse.json({

      performanceId,

      ...result,

    });

  } catch (error) {

    console.error("Evaluate error:", error);



    if (performanceId) {

      const db = getDb();

      await db

        .update(performances)

        .set({ status: "failed", updatedAt: new Date().toISOString() })

        .where(eq(performances.id, performanceId))

        .catch(() => undefined);

    }



    const message =

      error instanceof Error ? error.message : "Evaluation failed.";

    return NextResponse.json({ error: message }, { status: 500 });

  }

}


