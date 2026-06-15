"use client";

import { AUDIO_ACCEPT, AUDIO_UPLOAD_HINT } from "@/lib/upload/constants";
import { formatRecordingDuration } from "@/lib/audio/recording";
import type { AudioCaptureMode } from "@/hooks/use-audio-capture";

interface AudioCapturePanelProps {
  mode: AudioCaptureMode;
  onModeChange: (mode: AudioCaptureMode) => void;
  recording: boolean;
  recordingSeconds?: number;
  audioUrl: string | null;
  fileName: string | null;
  disabled?: boolean;
  restoring?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onFileSelected: (file: File) => void;
  recordDescription?: string;
  uploadDescription?: string;
}

export function AudioCapturePanel({
  mode,
  onModeChange,
  recording,
  recordingSeconds = 0,
  audioUrl,
  fileName,
  disabled = false,
  restoring = false,
  onStartRecording,
  onStopRecording,
  onFileSelected,
  recordDescription = "Allow microphone access, then record while you play.",
  uploadDescription = "Choose an existing recording from your device.",
}: AudioCapturePanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onModeChange("record")}
          disabled={disabled || recording}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            mode === "record"
              ? "border-amber-800 bg-amber-50 text-amber-900"
              : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          } disabled:opacity-60`}
        >
          Live record
        </button>
        <button
          type="button"
          onClick={() => onModeChange("upload")}
          disabled={disabled || recording}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            mode === "upload"
              ? "border-amber-800 bg-amber-50 text-amber-900"
              : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          } disabled:opacity-60`}
        >
          Upload file
        </button>
      </div>

      <p className="text-sm text-stone-500">
        {mode === "record" ? recordDescription : uploadDescription}
      </p>

      {mode === "record" ? (
        <div className="flex flex-wrap items-center gap-3">
          {!recording ? (
            <button
              type="button"
              onClick={onStartRecording}
              disabled={disabled || restoring}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              ● Record
            </button>
          ) : (
            <button
              type="button"
              onClick={onStopRecording}
              className="rounded-lg bg-stone-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-900"
            >
              ■ Stop
            </button>
          )}

          {recording && (
            <span className="flex items-center gap-2 text-sm font-medium tabular-nums text-red-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
              Recording {formatRecordingDuration(recordingSeconds)}
            </span>
          )}

          {restoring && !audioUrl && (
            <span className="text-sm text-stone-500">Restoring your last recording…</span>
          )}
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept={AUDIO_ACCEPT}
            disabled={disabled || restoring}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
              e.target.value = "";
            }}
            className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-900 hover:file:bg-amber-100 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-stone-500">{AUDIO_UPLOAD_HINT}</p>
        </div>
      )}

      {audioUrl && (
        <div>
          <p className="text-sm font-medium text-stone-700">Playback</p>
          {fileName && (
            <p className="mt-1 text-xs text-stone-500">{fileName}</p>
          )}
          <audio controls src={audioUrl} className="mt-2 w-full" />
        </div>
      )}
    </div>
  );
}
