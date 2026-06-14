import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";

import { getPiece, renumberPieces } from "@/lib/db/pieces";

import { pieces } from "@/lib/db/schema";

import { getSession } from "@/lib/auth/session";

import { deleteUserFile, saveUserFile } from "@/lib/storage/local";

import {

  audioExtension,

  detectAudioType,

  MAX_AUDIO_BYTES,

} from "@/lib/upload/detect-file-type";



export async function PATCH(

  request: Request,

  { params }: { params: Promise<{ id: string }> },

) {

  const session = await getSession();

  if (!session) {

    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  }



  const { id } = await params;

  const db = getDb();



  const piece = await db.query.pieces.findFirst({

    where: eq(pieces.id, id),

  });



  if (!piece || piece.userId !== session.userId) {

    return NextResponse.json({ error: "Not found." }, { status: 404 });

  }



  try {

    const formData = await request.formData();

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



    const filename = `${id}${audioExtension(audioType)}`;

    const buffer = Buffer.from(await audio.arrayBuffer());

    const referenceAudioPath = await saveUserFile(

      session.userId,

      "reference-audio",

      filename,

      buffer,

    );



    if (piece.referenceAudioPath) {

      await deleteUserFile(piece.referenceAudioPath).catch(() => undefined);

    }



    await db

      .update(pieces)

      .set({

        referenceAudioPath,

        referenceAudioType: audioType,

        fileSizeBytes: audio.size,

        updatedAt: new Date().toISOString(),

      })

      .where(eq(pieces.id, id));



    const item = await getPiece(id, session.userId);

    return NextResponse.json({ item });

  } catch (error) {

    console.error("Replace audio error:", error);

    return NextResponse.json({ error: "Upload failed." }, { status: 500 });

  }

}



export async function DELETE(

  _request: Request,

  { params }: { params: Promise<{ id: string }> },

) {

  const session = await getSession();

  if (!session) {

    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  }



  const { id } = await params;

  const db = getDb();



  const piece = await db.query.pieces.findFirst({

    where: eq(pieces.id, id),

  });



  if (!piece || piece.userId !== session.userId) {

    return NextResponse.json({ error: "Not found." }, { status: 404 });

  }



  try {

    if (piece.referenceAudioPath) {

      await deleteUserFile(piece.referenceAudioPath).catch(() => undefined);

    }



    await db.delete(pieces).where(eq(pieces.id, id));

    await renumberPieces(session.userId);



    return NextResponse.json({ ok: true });

  } catch (error) {

    console.error("Delete piece error:", error);

    return NextResponse.json({ error: "Delete failed." }, { status: 500 });

  }

}


