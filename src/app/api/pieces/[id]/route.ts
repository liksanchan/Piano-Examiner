import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";

import { getPiece, renumberPieces } from "@/lib/db/pieces";

import { pieces } from "@/lib/db/schema";

import { getSession } from "@/lib/auth/session";

import { deleteUserFile, saveUserFile } from "@/lib/storage/local";

import { audioExtension, MAX_AUDIO_BYTES } from "@/lib/upload/detect-file-type";
import { parseFormDataAudio } from "@/lib/upload/form-audio";
import { invalidateReferenceMidiCache } from "@/lib/evaluation/reference-midi-cache";



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
    const parsed = await parseFormDataAudio(formData);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (parsed.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio must be 50 MB or smaller." }, { status: 400 });
    }

    if (parsed.size < 1000) {
      return NextResponse.json(
        { error: "That recording looks empty. Record again or upload a file." },
        { status: 400 },
      );
    }

    const { audioType, buffer } = parsed;
    const filename = `${id}-${Date.now()}${audioExtension(audioType)}`;

    const referenceAudioPath = await saveUserFile(

      session.userId,

      "reference-audio",

      filename,

      buffer,

    );



    if (piece.referenceAudioPath) {
      await invalidateReferenceMidiCache(piece.referenceAudioPath).catch(() => undefined);
      await deleteUserFile(piece.referenceAudioPath).catch(() => undefined);
    }



    await db

      .update(pieces)

      .set({

        referenceAudioPath,

        referenceAudioType: audioType,

        fileSizeBytes: parsed.size,

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
      await invalidateReferenceMidiCache(piece.referenceAudioPath).catch(() => undefined);
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


