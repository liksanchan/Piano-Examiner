const RECORDING_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

const MIME_TO_FILENAME: Record<string, string> = {
  "audio/webm": "recording.webm",
  "audio/mp4": "recording.m4a",
  "audio/aac": "recording.m4a",
  "audio/ogg": "recording.ogg",
};

export function formatRecordingDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function isRecordingSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined",
  );
}

export function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;

  for (const mime of RECORDING_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return undefined;
}

export function filenameForMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_FILENAME[base] ?? "recording.webm";
}

export function recordingErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone permission was denied. Allow the mic in your browser settings, or switch to Upload file.";
    }
    if (error.name === "NotFoundError") {
      return "No microphone was found on this device. Switch to Upload file instead.";
    }
    if (error.name === "NotReadableError") {
      return "The microphone is in use by another app. Close other apps using the mic, or use Upload file.";
    }
    if (error.name === "SecurityError") {
      return "Recording needs a secure connection (HTTPS). If you are on the live site, try Upload file instead.";
    }
  }

  if (!isRecordingSupported()) {
    return "In-browser recording is not supported in this browser (common on some iPhones). Switch to Upload file.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not start recording. Try Upload file instead.";
}
