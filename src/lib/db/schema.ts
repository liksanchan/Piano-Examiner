import { sql } from "drizzle-orm";

import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";



export const users = sqliteTable("users", {

  id: text("id").primaryKey(),

  email: text("email").notNull().unique(),

  passwordHash: text("password_hash").notNull(),

  displayName: text("display_name"),

  createdAt: text("created_at")

    .notNull()

    .default(sql`(datetime('now'))`),

  updatedAt: text("updated_at")

    .notNull()

    .default(sql`(datetime('now'))`),

});



export const pieces = sqliteTable("pieces", {

  id: text("id").primaryKey(),

  userId: text("user_id")

    .notNull()

    .references(() => users.id, { onDelete: "cascade" }),

  title: text("title").notNull(),

  sortOrder: integer("sort_order").notNull().default(0),

  referenceAudioPath: text("reference_audio_path"),

  referenceAudioType: text("reference_audio_type", {

    enum: ["webm", "mp3", "wav", "m4a", "mp4", "ogg"],

  }),

  fileSizeBytes: integer("file_size_bytes"),

  createdAt: text("created_at")

    .notNull()

    .default(sql`(datetime('now'))`),

  updatedAt: text("updated_at")

    .notNull()

    .default(sql`(datetime('now'))`),

});



export const performances = sqliteTable("performances", {

  id: text("id").primaryKey(),

  userId: text("user_id")

    .notNull()

    .references(() => users.id, { onDelete: "cascade" }),

  pieceId: text("piece_id")

    .notNull()

    .references(() => pieces.id, { onDelete: "cascade" }),

  audioPath: text("audio_path").notNull(),

  examinerMode: text("examiner_mode", {
    enum: ["abrsm", "trinity", "accuracy100"],
  }).notNull(),

  checkTempo: integer("check_tempo", { mode: "boolean" }).notNull().default(true),

  checkDynamics: integer("check_dynamics", { mode: "boolean" }).notNull().default(true),

  checkNoteAccuracy: integer("check_note_accuracy", { mode: "boolean" })

    .notNull()

    .default(true),

  checkExpression: integer("check_expression", { mode: "boolean" })

    .notNull()

    .default(true),

  status: text("status", {

    enum: ["pending", "processing", "completed", "failed"],

  })

    .notNull()

    .default("pending"),

  totalScore: real("total_score"),

  maxScore: real("max_score"),

  scoreBreakdown: text("score_breakdown", { mode: "json" }).$type<

    Record<string, unknown>

  >(),

  feedback: text("feedback", { mode: "json" }).$type<Record<string, unknown>>(),

  createdAt: text("created_at")

    .notNull()

    .default(sql`(datetime('now'))`),

  updatedAt: text("updated_at")

    .notNull()

    .default(sql`(datetime('now'))`),

});



export type User = typeof users.$inferSelect;

export type Piece = typeof pieces.$inferSelect;

export type Performance = typeof performances.$inferSelect;

export type ExaminerMode = "abrsm" | "trinity" | "accuracy100";

export type ReferenceAudioType = NonNullable<Piece["referenceAudioType"]>;


