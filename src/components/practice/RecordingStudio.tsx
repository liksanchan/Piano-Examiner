"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import type { ExaminerMode } from "@/lib/db/schema";
import {
  clearPracticeRecording,
  loadPracticeRecording,
  savePracticeRecording,
  updateSavedPerformanceId,
} from "@/lib/practice/recording-cache";

interface RecordingStudioProps {
  pieceId: string;
  title: string;
  referenceAudioPath: string;
}

const CRITERIA = [
  { key: "checkTempo", label: "Speed / Tempo" },
  { key: "checkDynamics", label: "Dynamics" },
  { key: "checkNoteAccuracy", label: "Note Accuracy" },
  { key: "checkExpression", label: "Expression / Articulation" },
] as const;

const MODES: { id: ExaminerMode; label: string }[] = [
  { id: "abrsm", label: "ABRSM (out of 30)" },
  { id: "trinity", label: "Trinity (out of 22)" },
  { id: "accuracy100", label: "Note Accuracy (out of 100)" },
];

function fileUrl(filePath: string) {
  return `/api/files/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function RecordingStudio({
  pieceId,
  title,
  referenceAudioPath,
}: RecordingStudioProps) {
  const capture = useAudioCapture();

  const [examinerMode, setExaminerMode] = useState<ExaminerMode>("abrsm");
  const [settings, setSettings] = useState({
    checkTempo: true,
    checkDynamics: true,
    checkNoteAccuracy: true,
    checkExpression: true,
  });
  const [savedPerformanceId, setSavedPerformanceId] = useState<string | null>(null);
  const [lastResultId, setLastResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const isAccuracyMode = examinerMode === "accuracy100";

  useEffect(() => {
    let cancelled = false;

    loadPracticeRecording(pieceId)
      .then((cached) => {
        if (cancelled || !cached) return;
        capture.setFromBlob(cached.blob, cached.blob.type.includes("webm") ? "recording.webm" : "recording");
        if (cached.savedPerformanceId) {
          setSavedPerformanceId(cached.savedPerformanceId);
        }
      })
      .catch(() => {
        // IndexedDB unavailable — user can still record fresh.
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per piece
  }, [pieceId]);

  const resetPracticeRecording = useCallback(() => {
    setError(null);
    setSavedPerformanceId(null);
    setLastResultId(null);
    capture.clearAudio();
    void clearPracticeRecording(pieceId);
  }, [capture, pieceId]);

  const handleStartRecording = useCallback(async () => {
    resetPracticeRecording();
    try {
      await capture.startRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start recording.");
    }
  }, [capture, resetPracticeRecording]);

  const handleStopRecording = useCallback(() => {
    capture.stopRecording();
  }, [capture]);

  useEffect(() => {
    if (!capture.audioBlob || capture.recording) return;
    void savePracticeRecording(pieceId, capture.audioBlob);
  }, [capture.audioBlob, capture.recording, pieceId]);

  const handleFileSelected = useCallback(
    (file: File) => {
      try {
        resetPracticeRecording();
        capture.loadFile(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load file.");
      }
    },
    [capture, pieceId, resetPracticeRecording],
  );

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function handleSubmit() {
    if (!capture.audioBlob) {
      setError("Please record or upload your performance first.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("pieceId", pieceId);
      formData.append("examinerMode", examinerMode);
      formData.append("checkTempo", String(isAccuracyMode ? false : settings.checkTempo));
      formData.append("checkDynamics", String(isAccuracyMode ? false : settings.checkDynamics));
      formData.append("checkNoteAccuracy", "true");
      formData.append("checkExpression", String(isAccuracyMode ? false : settings.checkExpression));

      if (savedPerformanceId) {
        formData.append("reusePerformanceId", savedPerformanceId);
      } else {
        formData.append(
          "audio",
          capture.audioBlob,
          capture.fileName ?? "recording.webm",
        );
      }

      const perfRes = await fetch("/api/performances", {
        method: "POST",
        body: formData,
      });
      const perfData = await perfRes.json().catch(() => ({}));

      if (!perfRes.ok) {
        throw new Error(
          typeof perfData.error === "string"
            ? perfData.error
            : "Failed to save recording.",
        );
      }

      const performanceId = perfData.performance?.id as string;
      if (!performanceId) throw new Error("Invalid performance response.");

      if (!savedPerformanceId) {
        setSavedPerformanceId(performanceId);
        void updateSavedPerformanceId(pieceId, performanceId);
      }

      const evalRes = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ performanceId }),
      });
      const evalData = await evalRes.json().catch(() => ({}));

      if (!evalRes.ok) {
        throw new Error(
          typeof evalData.error === "string"
            ? evalData.error
            : "Evaluation failed.",
        );
      }

      setLastResultId(performanceId);
      window.open(`/results/${performanceId}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
        <p className="mt-1 text-sm text-stone-600">
          Listen to the reference recording, record or upload your performance, then submit
          for feedback. Your latest recording stays here so you can listen back and try other
          exam modes.
        </p>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-stone-900">Examiner settings</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-stone-700">Exam board mode</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {MODES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setExaminerMode(id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  examinerMode === id
                    ? "border-amber-800 bg-amber-50 text-amber-900"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isAccuracyMode ? (
          <p className="mt-5 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
            This mode scores <strong>note accuracy only</strong> out of 100 and lists
            where your notes were wrong, missing, or extra — grouped by part of the song.
          </p>
        ) : (
          <div className="mt-5">
            <p className="text-sm font-medium text-stone-700">Check criteria</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {CRITERIA.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={() => toggleSetting(key)}
                    className="h-4 w-4 rounded border-stone-300 text-amber-800 focus:ring-amber-700"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-stone-900">Reference recording</h2>
        <p className="mb-3 text-sm text-stone-500">
          This is the target performance the AI will compare your recording against.
        </p>
        <audio controls src={fileUrl(referenceAudioPath)} className="w-full" />
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-stone-900">Your recording</h2>

        <div className="mt-4">
          <AudioCapturePanel
            mode={capture.mode}
            onModeChange={capture.setMode}
            recording={capture.recording}
            audioUrl={capture.audioUrl}
            fileName={capture.fileName}
            disabled={submitting}
            restoring={restoring}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onFileSelected={handleFileSelected}
            recordDescription="Allow microphone access, then record while you play."
            uploadDescription="Upload a recording you made elsewhere (phone, DAW, etc.)."
          />
        </div>

        {capture.audioUrl && (
          <p className="mt-2 text-xs text-stone-500">
            Switch exam board mode above and submit again to compare feedback on the same take.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!capture.audioBlob || submitting || capture.recording || restoring}
          className="mt-5 w-full rounded-lg bg-amber-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Analyzing your performance…" : "Submit for examiner feedback"}
        </button>

        {lastResultId && (
          <p className="mt-3 text-sm text-stone-600">
            Latest results opened in a new tab.{" "}
            <Link
              href={`/results/${lastResultId}`}
              className="font-medium text-amber-800 hover:text-amber-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              View results again
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
