import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";

import { pieces, type Piece } from "@/lib/db/schema";



export async function listPieces(userId: string) {

  const db = getDb();

  const allPieces = await db.query.pieces.findMany({

    where: eq(pieces.userId, userId),

    orderBy: [asc(pieces.sortOrder), asc(pieces.createdAt)],

  });



  return renumberPieces(userId, allPieces);

}



export async function getPiece(pieceId: string, userId: string) {

  const db = getDb();

  const piece = await db.query.pieces.findFirst({

    where: eq(pieces.id, pieceId),

  });



  if (!piece || piece.userId !== userId) return null;

  return piece;

}



export async function getNextPieceSortOrder(userId: string) {

  const db = getDb();

  const all = await db.query.pieces.findMany({

    where: eq(pieces.userId, userId),

    columns: { sortOrder: true },

  });



  if (all.length === 0) return 1;

  return Math.max(...all.map((p) => p.sortOrder)) + 1;

}



export async function renumberPieces(userId: string, list?: Piece[]) {

  const db = getDb();

  const all =

    list ??

    (await db.query.pieces.findMany({

      where: eq(pieces.userId, userId),

      orderBy: [asc(pieces.sortOrder), asc(pieces.createdAt)],

    }));



  for (let i = 0; i < all.length; i++) {

    const order = i + 1;

    if (all[i].sortOrder !== order) {

      await db

        .update(pieces)

        .set({ sortOrder: order, updatedAt: new Date().toISOString() })

        .where(eq(pieces.id, all[i].id));

      all[i] = { ...all[i], sortOrder: order };

    }

  }



  return all;

}


