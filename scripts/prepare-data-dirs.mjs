import fs from "fs";
import path from "path";

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? "./data/piano-examiner.db",
);
const uploadDir = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR ?? "./data/uploads",
);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

console.log("Data directories ready.");
