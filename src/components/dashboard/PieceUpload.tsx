"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { audioFileForUpload } from "@/lib/upload/form-audio";

export function PieceUpload() {
  const router = useRouter();
  const capture = useAudioCapture();

  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!capture.audioBlob) {
      setError(
        capture.mode === "record"
          ? "Please record a reference performance first."
          : "Please choose a reference audio file.",
      );
      return;
    }

    if (capture.audioBlob.size < 1000) {
      setError(
        "That recording looks empty. Record again, allow microphone access, or use Upload file.",
      );
      return;
    }

    setError(null);
    setLoading(true);
    setProgress("Uploading…");

    const formData = new FormData();
    formData.append(
      "title",
      title.trim() || capture.fileName?.replace(/\.[^.]+$/, "") || "Untitled",
    );
    formData.append(
      "audio",
      audioFileForUpload(capture.audioBlob, capture.fileName ?? "reference.webm"),
    );

    const res = await fetch("/api/pieces", {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Upload failed.");
      setLoading(false);
      setProgress("");
      return;
    }

    setTitle("");
    capture.clearAudio();
    setProgress("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-stone-700">
          Song title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Moonlight Sonata"
          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-700/20"
        />
      </div>

      <div>
        <p className="block text-sm font-medium text-stone-700">Reference recording</p>
        <div className="mt-2">
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
            recordDescription="Record the reference performance using your microphone."
            uploadDescription="Upload a recording of the piece from your device."
          />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          The AI will compare your practice recordings against this reference.
          {capture.mode === "record" && !capture.recordingSupported && (
            <span className="mt-1 block text-amber-800">
              Live record is not supported in this browser — use Upload file instead.
            </span>
          )}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !capture.audioBlob || capture.recording}
        className="rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? progress || "Uploading…" : "Add song"}
      </button>
    </form>
  );
}
