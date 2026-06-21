import Link from "next/link";

import { requireUser } from "@/lib/auth/session";

import { listPieces } from "@/lib/db/pieces";

import { PieceUpload } from "@/components/dashboard/PieceUpload";

import { PieceList } from "@/components/dashboard/PieceList";



export const metadata = {

  title: "Dashboard — Piano Examiner",

};



export default async function DashboardPage() {

  const user = await requireUser();

  const items = await listPieces(user.id);
  const displayName = user.displayName ?? user.email.split("@")[0] ?? "Pianist";



  return (

    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">

      <h1 className="text-2xl font-semibold text-stone-900">

        Welcome, {displayName}

      </h1>

      <p className="mt-2 text-stone-600">

        Upload a reference recording for each song, then practice and get feedback.

      </p>



      <div className="mt-10 grid gap-8 lg:grid-cols-2">

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">

          <h2 className="font-semibold text-stone-900">Upload a song</h2>

          <p className="mt-1 text-sm text-stone-500">

            Add a title and a reference recording — upload a file or record live.

          </p>

          <div className="mt-5">

            <PieceUpload />

          </div>

        </section>



        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">

          <h2 className="font-semibold text-stone-900">Your songs</h2>

          <p className="mt-1 text-sm text-stone-500">

            Songs are numbered in upload order. Expand a song to listen or replace its audio.

          </p>

          <div className="mt-5">

            <PieceList items={items} />

          </div>

        </section>

      </div>



      <Link

        href="/"

        className="mt-8 inline-block text-sm font-medium text-amber-800 hover:text-amber-900"

      >

        ← Back to home

      </Link>

    </div>

  );

}


