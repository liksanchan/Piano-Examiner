"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectAudioType } from "@/lib/upload/detect-file-type";

export type AudioCaptureMode = "record" | "upload";

export function useAudioCapture() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playbackUrlRef = useRef<string | null>(null);

  const [mode, setMode] = useState<AudioCaptureMode>("record");
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const revokePlaybackUrl = useCallback(() => {
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  }, []);

  const setFromBlob = useCallback(
    (blob: Blob, name: string) => {
      revokePlaybackUrl();
      const url = URL.createObjectURL(blob);
      playbackUrlRef.current = url;
      setAudioBlob(blob);
      setAudioUrl(url);
      setFileName(name);
    },
    [revokePlaybackUrl],
  );

  const clearAudio = useCallback(() => {
    revokePlaybackUrl();
    setAudioUrl(null);
    setAudioBlob(null);
    setFileName(null);
  }, [revokePlaybackUrl]);

  const startRecording = useCallback(async () => {
    clearAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setFromBlob(blob, "recording.webm");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      throw new Error("Microphone access denied or unavailable.");
    }
  }, [clearAudio, setFromBlob]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const loadFile = useCallback(
    (file: File) => {
      if (!detectAudioType(file.type, file.name)) {
        throw new Error("Unsupported file type. Use MP3, WAV, WebM, M4A, MP4, or OGG.");
      }
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File must be 50 MB or smaller.");
      }
      setFromBlob(file, file.name);
    },
    [setFromBlob],
  );

  useEffect(() => {
    return () => revokePlaybackUrl();
  }, [revokePlaybackUrl]);

  return {
    mode,
    setMode,
    recording,
    audioUrl,
    audioBlob,
    fileName,
    setFromBlob,
    clearAudio,
    startRecording,
    stopRecording,
    loadFile,
  };
}
