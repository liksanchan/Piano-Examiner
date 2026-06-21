import fs from "fs/promises";
import path from "path";

import { getUploadDir } from "@/lib/db/paths";

/** Relative path for cached reference MIDI (same basename as reference audio, `.mid`). */
export function getReferenceMidiCachePath(referenceAudioPath: string): string {
  const dir = path.dirname(referenceAudioPath);
  const base = path.basename(referenceAudioPath, path.extname(referenceAudioPath));
  return path.join(dir, `${base}.mid`).replace(/\\/g, "/");
}

function resolveCacheFullPath(referenceAudioPath: string): string {
  return path.join(getUploadDir(), getReferenceMidiCachePath(referenceAudioPath));
}

/** Absolute path to cached reference MIDI, or null if not on disk. */
export async function getCachedReferenceMidiPath(
  referenceAudioPath: string,
): Promise<string | null> {
  const fullPath = resolveCacheFullPath(referenceAudioPath);
  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    return null;
  }
}

/** Remove cached reference MIDI when reference audio is replaced or deleted. */
export async function invalidateReferenceMidiCache(
  referenceAudioPath: string,
): Promise<void> {
  try {
    await fs.unlink(resolveCacheFullPath(referenceAudioPath));
  } catch {
    // Cache may not exist yet.
  }
}
