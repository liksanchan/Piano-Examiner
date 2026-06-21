import Link from "next/link";

import { notFound } from "next/navigation";

import { getCurrentUser, requireUser } from "@/lib/auth/session";

import { getPiece } from "@/lib/db/pieces";

import { RecordingStudio } from "@/components/practice/RecordingStudio";



export async function generateMetadata({

  params,

}: {

  params: Promise<{ pieceId: string }>;

}) {

  const { pieceId } = await params;

  const user = await getCurrentUser();

  if (!user) return { title: "Practice — Piano Examiner" };



  const piece = await getPiece(pieceId, user.id);

  return {

    title: piece ? `Practice: ${piece.title}` : "Practice — Piano Examiner",

  };

}



export default async function PracticePage({

  params,

}: {

  params: Promise<{ pieceId: string }>;

}) {

  const user = await requireUser();

  const { pieceId } = await params;
  const piece = await getPiece(pieceId, user.id);



  if (!piece || !piece.referenceAudioPath) notFound();



  return (

    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

      <Link

        href="/dashboard"

        className="text-sm font-medium text-amber-800 hover:text-amber-900"

      >

        ← Back to dashboard

      </Link>



      <div className="mt-6">

        <RecordingStudio

          pieceId={piece.id}

          title={piece.title}

          referenceAudioPath={piece.referenceAudioPath}

        />

      </div>

    </div>

  );

}


