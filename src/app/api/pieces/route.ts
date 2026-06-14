import { NextResponse } from "next/server";

import { randomUUID } from "crypto";

import { getDb } from "@/lib/db";

import { getNextPieceSortOrder, getPiece, listPieces } from "@/lib/db/pieces";

import { pieces } from "@/lib/db/schema";

import { getSession } from "@/lib/auth/session";

import { saveUserFile } from "@/lib/storage/local";

import {

  audioExtension,

  detectAudioType,

  MAX_AUDIO_BYTES,

} from "@/lib/upload/detect-file-type";



export async function GET() {

  const session = await getSession();

  if (!session) {

    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  }



  const items = await listPieces(session.userId);

  return NextResponse.json({ items });

}



export async function POST(request: Request) {

  const session = await getSession();

  if (!session) {

    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  }



  try {

    const formData = await request.formData();

    const title = String(formData.get("title") ?? "").trim();

    const audio = formData.get("audio");



    if (!(audio instanceof File)) {

      return NextResponse.json({ error: "An audio file is required." }, { status: 400 });

    }



    if (audio.size > MAX_AUDIO_BYTES) {

      return NextResponse.json({ error: "Audio must be 50 MB or smaller." }, { status: 400 });

    }



    const audioType = detectAudioType(audio.type, audio.name);

    if (!audioType) {

      return NextResponse.json(

        { error: "Only MP3, WAV, WebM, M4A, MP4, and OGG audio files are allowed." },

        { status: 400 },

      );

    }



    const resolvedTitle =

      title || audio.name.replace(/\.[^.]+$/, "") || "Untitled";



    const db = getDb();

    const pieceId = randomUUID();

    const sortOrder = await getNextPieceSortOrder(session.userId);

    const filename = `${pieceId}${audioExtension(audioType)}`;

    const buffer = Buffer.from(await audio.arrayBuffer());

    const referenceAudioPath = await saveUserFile(

      session.userId,

      "reference-audio",

      filename,

      buffer,

    );



    await db.insert(pieces).values({

      id: pieceId,

      userId: session.userId,

      title: resolvedTitle,

      sortOrder,

      referenceAudioPath,

      referenceAudioType: audioType,

      fileSizeBytes: audio.size,

    });



    const item = await getPiece(pieceId, session.userId);

    return NextResponse.json({ item }, { status: 201 });

  } catch (error) {

    console.error("Create piece error:", error);

    const message = error instanceof Error ? error.message : "Upload failed.";

    return NextResponse.json({ error: message }, { status: 400 });

  }

}


