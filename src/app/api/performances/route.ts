import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { performances, pieces } from "@/lib/db/schema";
import type { ExaminerMode } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { saveUserFile } from "@/lib/storage/local";
import { audioExtension, detectAudioType } from "@/lib/upload/detect-file-type";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

function parseBool(value: FormDataEntryValue | null, fallback = true) {
  if (value === null) return fallback;
  const s = String(value).toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const reusePerformanceId = String(formData.get("reusePerformanceId") ?? "");
    const pieceId = String(formData.get("pieceId") ?? "");
    const examinerMode = String(formData.get("examinerMode") ?? "abrsm") as ExaminerMode;

    if (!(audio instanceof File) && !reusePerformanceId) {
      return NextResponse.json({ error: "Audio recording is required." }, { status: 400 });
    }

    if (!pieceId) {
      return NextResponse.json({ error: "pieceId is required." }, { status: 400 });
    }

    if (
      examinerMode !== "abrsm" &&
      examinerMode !== "trinity" &&
      examinerMode !== "accuracy100"
    ) {
      return NextResponse.json({ error: "Invalid examiner mode." }, { status: 400 });
    }

    const isAccuracyMode = examinerMode === "accuracy100";

    if (audio instanceof File) {
      if (audio.size > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          { error: "Recording must be 50 MB or smaller." },
          { status: 400 },
        );
      }
      if (!detectAudioType(audio.type, audio.name)) {
        return NextResponse.json(
          { error: "Only MP3, WAV, WebM, M4A, MP4, and OGG audio files are allowed." },
          { status: 400 },
        );
      }
    }

    const db = getDb();
    const piece = await db.query.pieces.findFirst({
      where: and(eq(pieces.id, pieceId), eq(pieces.userId, session.userId)),
    });

    if (!piece) {
      return NextResponse.json({ error: "Piece not found." }, { status: 404 });
    }

    const id = randomUUID();
    let audioPath: string;

    if (reusePerformanceId) {
      const source = await db.query.performances.findFirst({
        where: and(
          eq(performances.id, reusePerformanceId),
          eq(performances.userId, session.userId),
          eq(performances.pieceId, pieceId),
        ),
      });

      if (!source) {
        return NextResponse.json(
          { error: "Could not reuse the previous recording." },
          { status: 400 },
        );
      }

      audioPath = source.audioPath;
    } else if (audio instanceof File) {
      const audioType = detectAudioType(audio.type, audio.name) ?? "webm";
      const filename = `${id}${audioExtension(audioType)}`;
      const buffer = Buffer.from(await audio.arrayBuffer());
      audioPath = await saveUserFile(
        session.userId,
        "performances",
        filename,
        buffer,
      );
    } else {
      return NextResponse.json({ error: "Audio recording is required." }, { status: 400 });
    }

    await db.insert(performances).values({
      id,
      userId: session.userId,
      pieceId,
      audioPath,
      examinerMode,
      checkTempo: isAccuracyMode ? false : parseBool(formData.get("checkTempo")),
      checkDynamics: isAccuracyMode ? false : parseBool(formData.get("checkDynamics")),
      checkNoteAccuracy: isAccuracyMode ? true : parseBool(formData.get("checkNoteAccuracy")),
      checkExpression: isAccuracyMode ? false : parseBool(formData.get("checkExpression")),
      status: "pending",
    });

    const performance = await db.query.performances.findFirst({
      where: eq(performances.id, id),
    });

    return NextResponse.json({ performance }, { status: 201 });
  } catch (error) {
    console.error("Performance upload error:", error);
    return NextResponse.json({ error: "Failed to save performance." }, { status: 500 });
  }
}
