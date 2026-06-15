import path from "path";



export type AudioFileType = "webm" | "mp3" | "wav" | "m4a" | "mp4" | "ogg";



const AUDIO_EXTENSIONS: Record<string, AudioFileType> = {

  ".webm": "webm",

  ".mp3": "mp3",

  ".wav": "wav",

  ".m4a": "m4a",

  ".mp4": "mp4",

  ".ogg": "ogg",

};



const AUDIO_MIMES: Record<string, AudioFileType> = {

  "audio/webm": "webm",

  "audio/mpeg": "mp3",

  "audio/mp3": "mp3",

  "audio/wav": "wav",

  "audio/x-wav": "wav",

  "audio/wave": "wav",

  "audio/mp4": "m4a",

  "audio/x-m4a": "m4a",

  "video/mp4": "mp4",

  "audio/ogg": "ogg",

  "video/webm": "webm",

  "audio/aac": "m4a",

};



export function detectAudioType(mime: string, filename: string): AudioFileType | null {

  const ext = path.extname(filename).toLowerCase();

  if (AUDIO_EXTENSIONS[ext]) return AUDIO_EXTENSIONS[ext];

  const baseMime = mime.split(";")[0]?.trim().toLowerCase() ?? "";

  if (AUDIO_MIMES[baseMime]) return AUDIO_MIMES[baseMime];

  if (AUDIO_MIMES[mime]) return AUDIO_MIMES[mime];

  return null;

}



export function audioExtension(type: AudioFileType): string {

  return `.${type}`;

}



export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;


