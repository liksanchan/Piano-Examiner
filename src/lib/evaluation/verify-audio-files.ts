import fs from "fs";
import path from "path";
import { getUploadDir } from "@/lib/db/paths";

const MIN_AUDIO_BYTES = 1000;

function resolveUploadPath(relativePath: string): string {
  return path.join(getUploadDir(), relativePath);
}

export function verifyAudioFile(label: string, relativePath: string | null | undefined): void {
  if (!relativePath) {
    throw new Error(`${label} is missing. Upload a reference recording first.`);
  }

  const absolutePath = resolveUploadPath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `${label} was not found on the server. On Render's free tier, files can be lost after a redeploy — re-upload the reference recording and record your performance again.`,
    );
  }

  const { size } = fs.statSync(absolutePath);
  if (size < MIN_AUDIO_BYTES) {
    throw new Error(
      `${label} looks empty or corrupt (${size} bytes). Record again or upload a different file.`,
    );
  }
}
