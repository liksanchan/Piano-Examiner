import type { AnalysisMetrics, EvaluationResult } from "@/lib/evaluation/types";

export type PerformanceQuality = "fail" | "weak" | "acceptable";

export function assessPerformanceQuality(metrics: AnalysisMetrics): PerformanceQuality {
  const { midi } = metrics;
  const refNotes = midi.reference_note_count;

  if (refNotes < 8) {
    return "acceptable";
  }

  const matchRatio = midi.matched_notes / refNotes;
  const contour =
    midi.essentia_pitch_contour_similarity ?? midi.pitch_contour_similarity;

  const isFail =
    midi.note_accuracy_percent < 30 ||
    matchRatio < 0.15 ||
    (contour !== null && contour < 0.2 && midi.note_accuracy_percent < 45);

  if (isFail) return "fail";

  const isWeak =
    midi.note_accuracy_percent < 50 ||
    matchRatio < 0.35 ||
    (contour !== null && contour < 0.35);

  if (isWeak) return "weak";

  return "acceptable";
}

function scoreCap(mode: EvaluationResult["examinerMode"], quality: PerformanceQuality) {
  if (mode === "accuracy100") {
    if (quality === "fail") return 15;
    if (quality === "weak") return 45;
    return null;
  }
  if (quality === "fail") return mode === "abrsm" ? 5 : 4;
  if (quality === "weak") return mode === "abrsm" ? 14 : 10;
  return null;
}

function scaleBreakdown(
  breakdown: EvaluationResult["scoreBreakdown"],
  scale: number,
): EvaluationResult["scoreBreakdown"] {
  const scaled: EvaluationResult["scoreBreakdown"] = {};
  for (const [key, criterion] of Object.entries(breakdown)) {
    scaled[key] = {
      ...criterion,
      score: Math.round(criterion.score * scale * 10) / 10,
    };
  }
  return scaled;
}

function failFeedback(
  pieceTitle: string,
  quality: PerformanceQuality,
  metrics: AnalysisMetrics,
  mode: EvaluationResult["examinerMode"],
  existing?: EvaluationResult["feedback"],
): EvaluationResult["feedback"] {
  const accuracy = metrics.midi.note_accuracy_percent;

  if (quality === "fail") {
    const failSummary =
      mode === "accuracy100"
        ? `This does not appear to be a performance of "${pieceTitle}". Only ${accuracy}% of reference notes were correct (out of 100).`
        : `This does not appear to be a performance of "${pieceTitle}". Only ${accuracy}% of the reference notes were matched. In a real exam this would be classified as a fail.`;
    return {
      summary: failSummary,
      strengths: [],
      improvements: [
        "Play the actual piece from the reference recording, not unrelated sounds or noise.",
        "Check microphone placement and reduce background noise.",
        "Practice in short sections until the notes match the reference.",
      ],
      noteErrors: existing?.noteErrors,
      sectionSummary: existing?.sectionSummary,
    };
  }

  return {
    summary: `Limited resemblance to "${pieceTitle}" (${accuracy}% note match). A real examiner would likely award a low mark until the piece is recognisable.`,
    strengths: [],
    improvements: [
      "Focus on playing the correct notes in the correct order.",
      "Practice slowly with the reference recording.",
      "Work on evenness before attempting full tempo.",
    ],
    noteErrors: existing?.noteErrors,
    sectionSummary: existing?.sectionSummary,
  };
}

export function calibrateEvaluation(
  result: EvaluationResult,
  metrics: AnalysisMetrics,
  pieceTitle: string,
): EvaluationResult {
  const quality = assessPerformanceQuality(metrics);
  const cap = scoreCap(result.examinerMode, quality);

  if (!cap || result.totalScore <= cap) {
    if (quality === "fail" || quality === "weak") {
      return {
        ...result,
        feedback: failFeedback(
          pieceTitle,
          quality,
          metrics,
          result.examinerMode,
          result.feedback,
        ),
      };
    }
    return result;
  }

  const scale = cap / result.totalScore;
  const breakdown = scaleBreakdown(result.scoreBreakdown, scale);
  const totalScore = Math.round(
    Object.values(breakdown).reduce((sum, c) => sum + c.score, 0) * 10,
  ) / 10;

  return {
    ...result,
    totalScore: Math.min(totalScore, cap),
    scoreBreakdown: breakdown,
    feedback: failFeedback(
      pieceTitle,
      quality,
      metrics,
      result.examinerMode,
      result.feedback,
    ),
  };
}
