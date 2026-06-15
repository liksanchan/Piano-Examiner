import { detectAudioType, type AudioFileType } from "@/lib/upload/detect-file-type";

export function audioFileForUpload(blob: Blob, fileName: string): File {
  if (blob instanceof File && blob.name === fileName) {
    return blob;
  }
  return new File([blob], fileName, {
    type: blob.type || "audio/webm",
  });
}

export type ParsedFormAudio =
  | {
      ok: true;
      buffer: Buffer;
      name: string;
      audioType: AudioFileType;
      size: number;
    }
  | { ok: false; error: string };

export async function parseFormDataAudio(formData: FormData): Promise<ParsedFormAudio> {
  const audio = formData.get("audio");

  if (!audio || typeof audio === "string") {
    return { ok: false, error: "An audio file is required." };
  }

  if (!(audio instanceof Blob)) {
    return { ok: false, error: "An audio file is required." };
  }

  const name =
    audio instanceof File && audio.name.trim().length > 0 ? audio.name : "reference.webm";

  const audioType = detectAudioType(audio.type, name);
  if (!audioType) {
    return {
      ok: false,
      error: "Only MP3, WAV, WebM, M4A, MP4, and OGG audio files are allowed.",
    };
  }

  const buffer = Buffer.from(await audio.arrayBuffer());

  return {
    ok: true,
    buffer,
    name,
    audioType,
    size: audio.size,
  };
}
