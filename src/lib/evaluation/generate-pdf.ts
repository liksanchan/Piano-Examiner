import { jsPDF } from "jspdf";
import type { ExaminerMode, Performance, Piece } from "@/lib/db/schema";
import { formatNoteError } from "@/lib/evaluation/accuracy100";
import {
  type CriterionScore,
  type NoteError,
  examinerModeLabel,
  formatCriterionLabel,
} from "@/lib/evaluation/types";

export interface PdfReportInput {
  performance: Pick<Performance, "examinerMode" | "totalScore" | "maxScore" | "scoreBreakdown" | "feedback">;
  piece: Pick<Piece, "title">;
}

function parseFeedback(feedback: Performance["feedback"]) {
  if (!feedback || typeof feedback !== "object") {
    return {
      summary: "",
      strengths: [] as string[],
      improvements: [] as string[],
      noteErrors: [] as NoteError[],
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
    noteErrors: Array.isArray(f.noteErrors) ? (f.noteErrors as NoteError[]) : [],
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

export function generateResultPdf({ performance, piece }: PdfReportInput) {
  const breakdown = parseBreakdown(performance.scoreBreakdown);
  const feedback = parseFeedback(performance.feedback);
  const mode = performance.examinerMode as ExaminerMode;
  const totalScore = performance.totalScore ?? 0;
  const maxScore =
    performance.maxScore ??
    (mode === "accuracy100" ? 100 : mode === "abrsm" ? 30 : 22);
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  doc.setFontSize(18);
  doc.text("Piano Examiner — Performance Report", margin, y);
  y += 12;

  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Piece: ${piece.title}`, margin, y);
  y += 7;
  doc.text(`Exam board: ${examinerModeLabel(mode)}`, margin, y);
  y += 7;
  doc.text(`Score: ${totalScore} / ${maxScore} (${pct}%)`, margin, y);
  y += 12;

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.text("Score breakdown", margin, y);
  y += 8;
  doc.setFontSize(10);

  for (const [key, criterion] of Object.entries(breakdown)) {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.text(
      `${formatCriterionLabel(key)}: ${criterion.score}/${criterion.max}`,
      margin,
      y,
    );
    y += 5;
    const lines = doc.splitTextToSize(criterion.comment, 170);
    doc.setTextColor(80);
    doc.text(lines, margin, y);
    doc.setTextColor(0);
    y += lines.length * 5 + 4;
  }

  if (y > 250) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(13);
  doc.text("Examiner feedback", margin, y);
  y += 8;
  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(feedback.summary, 170);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 6;

  if (feedback.strengths.length) {
    doc.text("Strengths:", margin, y);
    y += 5;
    feedback.strengths.forEach((s) => {
      doc.text(`• ${s}`, margin + 4, y);
      y += 5;
    });
    y += 3;
  }

  if (feedback.improvements.length) {
    if (y > 265) {
      doc.addPage();
      y = margin;
    }
    doc.text("Areas for improvement:", margin, y);
    y += 5;
    feedback.improvements.forEach((s) => {
      doc.text(`• ${s}`, margin + 4, y);
      y += 5;
    });
  }

  if (feedback.noteErrors.length) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }
    y += 6;
    doc.setFontSize(13);
    doc.text("Where notes were wrong", margin, y);
    y += 8;
    doc.setFontSize(9);
    feedback.noteErrors.slice(0, 40).forEach((error) => {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      const line = formatNoteError(error);
      const lines = doc.splitTextToSize(`• ${line}`, 170);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 2;
    });
  }

  const filename = `piano-examiner-${piece.title.replace(/[^\w-]+/g, "-")}.pdf`;
  const blob = doc.output("blob");

  return { blob, filename, totalScore, maxScore, mode, pct };
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function sharePdfViaWhatsApp(
  blob: Blob,
  filename: string,
  shareText: string,
) {
  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      text: shareText,
      title: "Piano Exam Results",
    });
    return;
  }

  downloadPdfBlob(blob, filename);

  const message =
    `${shareText}\n\n` +
    "The PDF report has been downloaded — please attach it in WhatsApp.";
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
}
