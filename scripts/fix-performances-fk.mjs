/**
 * Fixes performances FK: sheet_music → pieces (SQLite keeps old FK after column rename).
 */
import { createClient } from "@libsql/client";
import { pathToFileURL } from "url";
import path from "path";

const client = createClient({
  url: pathToFileURL(
    path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "./data/piano-examiner.db"),
  ).href,
});

const ddl = await client.execute(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='performances'",
);

const createSql = ddl.rows[0]?.sql;
if (typeof createSql !== "string") {
  console.log("No performances table found.");
  process.exit(0);
}

if (!createSql.includes("sheet_music")) {
  console.log("performances FK already points to pieces. Nothing to do.");
  process.exit(0);
}

console.log("Fixing performances foreign key...");

await client.executeMultiple(`
  PRAGMA foreign_keys=OFF;
  BEGIN;
  CREATE TABLE performances_new (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    audio_path TEXT NOT NULL,
    examiner_mode TEXT NOT NULL,
    check_tempo INTEGER NOT NULL DEFAULT 1,
    check_dynamics INTEGER NOT NULL DEFAULT 1,
    check_note_accuracy INTEGER NOT NULL DEFAULT 1,
    check_expression INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    total_score REAL,
    max_score REAL,
    score_breakdown TEXT,
    feedback TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO performances_new SELECT * FROM performances;
  DROP TABLE performances;
  ALTER TABLE performances_new RENAME TO performances;
  COMMIT;
  PRAGMA foreign_keys=ON;
`);

console.log("performances table recreated with piece_id → pieces FK.");
