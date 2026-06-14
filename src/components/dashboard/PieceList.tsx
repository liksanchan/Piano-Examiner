"use client";



import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import type { Piece } from "@/lib/db/schema";



function formatDate(iso: string) {

  return new Date(iso).toLocaleDateString("en-GB", {

    day: "numeric",

    month: "short",

    year: "numeric",

  });

}



function fileUrl(filePath: string) {

  return `/api/files/${filePath.split("/").map(encodeURIComponent).join("/")}`;

}



function formatFileSize(bytes: number | null) {

  if (!bytes) return "";

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

}



function ReplaceAudioForm({ pieceId, onDone }: { pieceId: string; onDone: () => void }) {
  const capture = useAudioCapture();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!capture.audioBlob) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append(
      "audio",
      capture.audioBlob,
      capture.fileName ?? "reference.webm",
    );

    const res = await fetch(`/api/pieces/${pieceId}`, {
      method: "PATCH",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Upload failed.");
      setLoading(false);
      return;
    }

    capture.clearAudio();
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-dashed border-stone-300 p-3">
      <p className="text-xs font-medium text-stone-600">Replace reference recording</p>
      <AudioCapturePanel
        mode={capture.mode}
        onModeChange={capture.setMode}
        recording={capture.recording}
        audioUrl={capture.audioUrl}
        fileName={capture.fileName}
        disabled={loading}
        onStartRecording={async () => {
          setError(null);
          capture.clearAudio();
          try {
            await capture.startRecording();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not start recording.");
          }
        }}
        onStopRecording={capture.stopRecording}
        onFileSelected={(file) => {
          try {
            setError(null);
            capture.clearAudio();
            capture.loadFile(file);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load file.");
          }
        }}
        recordDescription="Record a new reference take."
        uploadDescription="Upload a new reference file."
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !capture.audioBlob || capture.recording}
        className="rounded bg-stone-800 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Replace audio"}
      </button>
    </form>
  );
}



export function PieceList({ items }: { items: Piece[] }) {

  const router = useRouter();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);



  async function handleDeletePiece(id: string, title: string) {

    if (!window.confirm(`Delete "${title}"?`)) return;



    setError(null);

    setDeletingId(id);

    const res = await fetch(`/api/pieces/${id}`, { method: "DELETE" });

    const data = await res.json().catch(() => ({}));



    if (!res.ok) {

      setError(typeof data.error === "string" ? data.error : "Delete failed.");

      setDeletingId(null);

      return;

    }



    setDeletingId(null);

    router.refresh();

  }



  if (items.length === 0) {

    return (

      <p className="text-sm text-stone-500">

        No songs yet. Upload your first piece above.

      </p>

    );

  }



  return (

    <div>

      {error && (

        <p className="mb-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">

          {error}

        </p>

      )}



      <ul className="divide-y divide-stone-100">

        {items.map((item, index) => {

          const expanded = expandedId === item.id;

          const hasAudio = Boolean(item.referenceAudioPath);

          const sizeLabel = formatFileSize(item.fileSizeBytes);



          return (

            <li key={item.id} className="py-4 first:pt-0 last:pb-0">

              <div className="flex items-center justify-between gap-3">

                <div className="flex min-w-0 items-start gap-3">

                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">

                    {index + 1}

                  </span>

                  <div className="min-w-0">

                    <button

                      type="button"

                      onClick={() => setExpandedId(expanded ? null : item.id)}

                      className="truncate text-left font-medium text-stone-900 hover:text-amber-900"

                    >

                      {item.title}

                    </button>

                    <p className="text-xs text-stone-500">

                      {hasAudio ? `Reference audio${sizeLabel ? ` · ${sizeLabel}` : ""}` : "No audio — re-upload needed"}

                      {" · "}

                      {formatDate(item.createdAt)}

                    </p>

                  </div>

                </div>



                <div className="flex shrink-0 items-center gap-2">

                  <button

                    type="button"

                    onClick={() => setExpandedId(expanded ? null : item.id)}

                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"

                  >

                    {expanded ? "Hide" : hasAudio ? "Listen" : "Add audio"}

                  </button>

                  <button

                    type="button"

                    onClick={() => handleDeletePiece(item.id, item.title)}

                    disabled={deletingId === item.id}

                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"

                  >

                    {deletingId === item.id ? "…" : "Delete"}

                  </button>

                  {hasAudio ? (

                    <Link

                      href={`/practice/${item.id}`}

                      className="rounded-lg bg-amber-800 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-900"

                    >

                      Practice

                    </Link>

                  ) : (

                    <span className="rounded-lg bg-stone-200 px-3.5 py-1.5 text-sm font-semibold text-stone-400">

                      Practice

                    </span>

                  )}

                </div>

              </div>



              {expanded && hasAudio && item.referenceAudioPath && (

                <div className="mt-4 pl-10">

                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">

                    <p className="mb-2 text-xs font-bold text-amber-900">Reference recording</p>

                    <audio controls src={fileUrl(item.referenceAudioPath)} className="w-full" />

                  </div>

                  <ReplaceAudioForm pieceId={item.id} onDone={() => router.refresh()} />

                </div>

              )}



              {expanded && !hasAudio && (

                <div className="mt-4 pl-10">

                  <ReplaceAudioForm pieceId={item.id} onDone={() => router.refresh()} />

                </div>

              )}

            </li>

          );

        })}

      </ul>

    </div>

  );

}


