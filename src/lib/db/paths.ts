import path from "path";

export function getDatabasePath() {
  return path.resolve(
    process.cwd(),
    process.env.DATABASE_PATH ?? "./data/piano-examiner.db",
  );
}

export function getUploadDir() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./data/uploads");
}
