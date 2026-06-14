import fs from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/db/paths";

export async function saveUserFile(
  userId: string,
  category: "reference-audio" | "performances",
  filename: string,
  data: Buffer,
) {
  const dir = path.join(getUploadDir(), userId, category);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, data);
  return path.relative(getUploadDir(), filePath).replace(/\\/g, "/");
}

export async function readUserFile(relativePath: string) {
  const fullPath = path.join(getUploadDir(), relativePath);
  const normalizedUpload = path.resolve(getUploadDir());
  const normalizedFull = path.resolve(fullPath);

  if (!normalizedFull.startsWith(normalizedUpload)) {
    throw new Error("Invalid file path.");
  }

  return fs.readFile(normalizedFull);
}

export async function deleteUserFile(relativePath: string) {
  const fullPath = path.join(getUploadDir(), relativePath);
  const normalizedUpload = path.resolve(getUploadDir());
  const normalizedFull = path.resolve(fullPath);

  if (!normalizedFull.startsWith(normalizedUpload)) {
    throw new Error("Invalid file path.");
  }

  await fs.unlink(normalizedFull);
}

export function userOwnsFile(userId: string, relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized.startsWith(`${userId}/`);
}

export function getMimeType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webm": "audio/webm",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".ogg": "audio/ogg",
  };
  return map[ext] ?? "application/octet-stream";
}
