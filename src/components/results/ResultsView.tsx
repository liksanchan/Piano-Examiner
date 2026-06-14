"use client";

import Link from "next/link";
import { useState } from "react";
import type { ExaminerMode, Performance, Piece } from "@/lib/db/schema";
import { formatNoteError } from "@/lib/evaluation/accuracy100";
import {
  type CriterionScore,
  type NoteError,
  type SectionStats,
  examinerModeLabel,
  formatCriterionLabel,
} from "@/lib/evaluation/types";
import {
  downloadPdfBlob,
  generateResultPdf,
  sharePdfViaWhatsApp,
} from "@/lib/evaluation/generate-pdf";

interface ResultsViewProps {
  performance: Performance;
  piece: Piece;
}

function parseFeedback(feedback: Performance["feedback"]) {
  if (!feedback || typeof feedback !== "object") {
    return {
      summary: "",
      strengths: [] as string[],
      improvements: [] as string[],
      noteErrors: [] as NoteError[],
      sectionSummary: {} as Record<string, SectionStats>,
    };
  }
  const f = feedback as Record<string, unknown>;
  return {
    summary: typeof f.summary === "string" ? f.summary : "",
    strengths: Array.isArray(f.strengths)
      ? f.strengths.filter((s): s is string => typeof s === "string")
      : [],
    improvements: Array.isArray(f.improvements)
      ? f.improvements.filter((s): s is string => typeof s === "string")
      : [],
    noteErrors: Array.isArray(f.noteErrors)
      ? (f.noteErrors as NoteError[])
      : [],
    sectionSummary:
      f.sectionSummary && typeof f.sectionSummary === "object"
        ? (f.sectionSummary as Record<string, SectionStats>)
        : {},
  };
}

function parseBreakdown(
  breakdown: Performance["scoreBreakdown"],
): Record<string, CriterionScore> {
  if (!breakdown || typeof breakdown !== "object") return {};
  const result: Record<string, CriterionScore> = {};
  for (const [key, val] of Object.entries(breakdown)) {
    if (val && typeof val === "object" && "score" in val && "max" in val) {
      result[key] = val as CriterionScore;
    }
  }
  return result;
}

const SECTION_ORDER = ["Opening", "First half", "Second half", "Ending"];

export function ResultsView({ performance, piece }: ResultsViewProps) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const breakdown = parseBreakdown(performance.scoreBreakdown);
  const feedback = parseFeedback(performance.feedback);
  const mode = performance.examinerMode as ExaminerMode;
  const totalScore = performance.totalScore ?? 0;
  const maxScore =
    performance.maxScore ??
    (mode === "accuracy100" ? 100 : mode === "abrsm" ? 30 : 22);
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const isAccuracyMode = mode === "accuracy100";

  const errorsBySection = SECTION_ORDER.map((section) => ({
    section,
    errors: feedback.noteErrors.filter((e) => e.section === section),
    stats: feedback.sectionSummary[section],
  })).filter((g) => g.errors.length > 0 || g.stats);

  function getPdf() {
    return generateResultPdf({ performance, piece });
  }

  function downloadPdf() {
    const { blob, filename } = getPdf();
    downloadPdfBlob(blob, filename);
  }

  async function shareWhatsApp() {
    setShareError(null);
    setSharing(true);

    try {
      const { blob, filename } = getPdf();
      const shareText = `Piano Examiner — ${piece.title}: ${totalScore}/${maxScore} (${examinerModeLabel(mode)})`;
      await sharePdfViaWhatsApp(blob, filename, shareText);
    } catch {
      setShareError(
        "Could not share to WhatsApp. Try downloading the PDF instead.",
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-800">
          {examinerModeLabel(mode)}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          {piece.title}
        </h1>

        <div className="mt-6 flex items-end gap-3">
          <span className="text-5xl font-bold text-stone-900">{totalScore}</span>
          <span className="pb-2 text-2xl text-stone-400">/ {maxScore}</span>
          <span className="mb-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
            {pct}%
          </span>
        </div>
      </div>

      {!isAccuracyMode && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-stone-900">Score breakdown</h2>
          <div className="mt-4 space-y-4">
            {Object.entries(breakdown).map(([key, criterion]) => (
              <div key={key} className="rounded-lg border border-stone-100 bg-stone-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-stone-900">
                    {formatCriterionLabel(key)}
                  </p>
                  <p className="text-sm font-semibold text-amber-900">
                    {criterion.score} / {criterion.max}
                  </p>
                </div>
                <p className="mt-2 text-sm text-stone-600">{criterion.comment}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {isAccuracyMode && breakdown.noteAccuracy && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-stone-900">Note accuracy</h2>
          <p className="mt-2 text-sm text-stone-600">{breakdown.noteAccuracy.comment}</p>
        </section>
      )}

      {isAccuracyMode && errorsBySection.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-stone-900">Where your notes were wrong</h2>
          <p className="mt-1 text-sm text-stone-500">
            Errors are grouped by part of the song (based on timing in the reference).
          </p>

          <div className="mt-5 space-y-5">
            {errorsBySection.map(({ section, errors, stats }) => (
              <div
                key={section}
                className="rounded-lg border border-stone-100 bg-stone-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-amber-900">{section}</h3>
                  {stats && (
                    <p className="text-xs text-stone-500">
                      {stats.correct} correct · {stats.wrong} wrong · {stats.missing} missing
                    </p>
                  )}
                </div>
                {errors.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
                    {errors.map((error, i) => (
                      <li key={`${section}-${error.time_seconds}-${i}`}>
                        {formatNoteError(error)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-stone-500">No errors detected in this section.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900">Examiner feedback</h2>
        <p className="mt-3 text-stone-700 leading-relaxed">{feedback.summary}</p>

        {feedback.strengths.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium text-stone-900">Strengths</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-600">
              {feedback.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {feedback.improvements.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium text-stone-900">Areas for improvement</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-600">
              {feedback.improvements.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {shareError && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
          {shareError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadPdf}
          className="rounded-lg bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-900"
        >
          Download as PDF
        </button>
        <button
          type="button"
          onClick={shareWhatsApp}
          disabled={sharing}
          className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-60"
        >
          {sharing ? "Preparing PDF…" : "Share PDF to WhatsApp"}
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
