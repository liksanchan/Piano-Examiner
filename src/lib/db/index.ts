import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { pathToFileURL } from "url";
import * as schema from "./schema";
import { getDatabasePath, getUploadDir } from "./paths";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function ensureDataDirs() {
  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(getUploadDir(), { recursive: true });
}

export function getDb() {
  if (!db) {
    ensureDataDirs();
    const client = createClient({
      url: pathToFileURL(getDatabasePath()).href,
    });
    db = drizzle(client, { schema });
  }
  return db;
}
