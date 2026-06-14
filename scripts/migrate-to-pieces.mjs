/**
 * Migrates legacy sheet_music table to pieces + piece_pages.
 * Safe to run multiple times — skips if sheet_music does not exist.
 */
import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
import { pathToFileURL } from "url";
import path from "path";

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? "./data/piano-examiner.db",
);

const client = createClient({ url: pathToFileURL(dbPath).href });

async function tableExists(name) {
  const r = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`,
  );
  return r.rows.length > 0;
}

async function migrate() {
  const hasLegacy = await tableExists("sheet_music");
  const hasPieces = await tableExists("pieces");

  if (!hasLegacy && hasPieces) {
    console.log("Already migrated.");
    return;
  }

  if (!hasPieces) {
    await client.execute(`
      CREATE TABLE pieces (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await client.execute(`
      CREATE TABLE piece_pages (
        id TEXT PRIMARY KEY,
        piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        page_order INTEGER NOT NULL,
        file_size_bytes INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created pieces and piece_pages tables.");
  }

  if (hasLegacy) {
    const rows = await client.execute("SELECT * FROM sheet_music ORDER BY sort_order, created_at");
    for (const row of rows.rows) {
      const id = row.id;
      await client.execute({
        sql: `INSERT OR IGNORE INTO pieces (id, user_id, title, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          row.user_id,
          row.title,
          row.sort_order ?? 0,
          row.created_at,
          row.updated_at,
        ],
      });
      await client.execute({
        sql: `INSERT OR IGNORE INTO piece_pages (id, piece_id, file_path, file_type, page_order, file_size_bytes, created_at)
              VALUES (?, ?, ?, ?, 1, ?, ?)`,
        args: [
          randomUUID(),
          id,
          row.file_path,
          row.file_type,
          row.file_size_bytes,
          row.created_at,
        ],
      });
    }
    console.log(`Migrated ${rows.rows.length} sheet_music rows.`);

    await client.execute("DROP TABLE sheet_music");
    console.log("Dropped sheet_music table.");
  }

  if (await tableExists("performances")) {
    const cols = await client.execute("PRAGMA table_info(performances)");
    const names = cols.rows.map((c) => c.name);
    if (names.includes("sheet_music_id") && !names.includes("piece_id")) {
      await client.execute(
        "ALTER TABLE performances RENAME COLUMN sheet_music_id TO piece_id",
      );
      console.log("Renamed performances.sheet_music_id → piece_id.");
    }

    const ddl = await client.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='performances'",
    );
    const createSql = ddl.rows[0]?.sql;
    if (typeof createSql === "string" && createSql.includes("sheet_music")) {
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
      console.log("Recreated performances with piece_id → pieces FK.");
    }
  }

  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
