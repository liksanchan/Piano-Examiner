/**
 * Migrates pieces from sheet-music pages (piece_pages) to reference audio on pieces.
 * Safe to run multiple times.
 */
import { createClient } from "@libsql/client";
import path from "path";
import { pathToFileURL } from "url";

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

async function columnExists(table, column) {
  const r = await client.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === column);
}

async function migrate() {
  if (!(await tableExists("pieces"))) {
    console.log("No pieces table — run db:migrate first.");
    return;
  }

  if (!(await columnExists("pieces", "reference_audio_path"))) {
    await client.execute(`ALTER TABLE pieces ADD COLUMN reference_audio_path TEXT`);
    console.log("Added pieces.reference_audio_path");
  }

  if (!(await columnExists("pieces", "reference_audio_type"))) {
    await client.execute(`ALTER TABLE pieces ADD COLUMN reference_audio_type TEXT`);
    console.log("Added pieces.reference_audio_type");
  }

  if (!(await columnExists("pieces", "file_size_bytes"))) {
    await client.execute(`ALTER TABLE pieces ADD COLUMN file_size_bytes INTEGER`);
    console.log("Added pieces.file_size_bytes");
  }

  if (await tableExists("piece_pages")) {
    await client.execute("DROP TABLE piece_pages");
    console.log(
      "Dropped piece_pages table. Re-upload songs as reference audio files.",
    );
  } else {
    console.log("piece_pages already removed.");
  }

  console.log("Audio migration complete.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
