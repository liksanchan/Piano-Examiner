"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  filenameForMimeType,
  isRecordingSupported,
  pickRecordingMimeType,
  recordingErrorMessage,
} from "@/lib/audio/recording";
import { detectAudioType } from "@/lib/upload/detect-file-type";

export type AudioCaptureMode = "record" | "upload";

export function useAudioCapture() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playbackUrlRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  const [mode, setMode] = useState<AudioCaptureMode>("record");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
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

    if (!isRecordingSupported()) {
      throw new Error(
        "In-browser recording is not supported in this browser. Switch to Upload file instead.",
      );
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      throw new Error(recordingErrorMessage(error));
    }

    try {
      const mimeType = pickRecordingMimeType();
      mimeTypeRef.current = mimeType ?? "audio/webm";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const type = mimeTypeRef.current || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const name = filenameForMimeType(type);
        setFromBlob(blob, name);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      // Timeslices help Safari/iOS actually emit audio data.
      recorder.start(250);
      setRecording(true);
    } catch (error) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(recordingErrorMessage(error));
    }
  }, [clearAudio, setFromBlob]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      return Promise.resolve();
    }

    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });

    recorder.stop();
    setRecording(false);
    return stopped;
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
    if (!recording) {
      setRecordingSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const tick = () => {
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    return () => revokePlaybackUrl();
  }, [revokePlaybackUrl]);

  return {
    mode,
    setMode,
    recording,
    recordingSeconds,
    audioUrl,
    audioBlob,
    fileName,
    recordingSupported: isRecordingSupported(),
    setFromBlob,
    clearAudio,
    startRecording,
    stopRecording,
    loadFile,
  };
}
