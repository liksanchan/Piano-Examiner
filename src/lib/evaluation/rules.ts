import type {
  AnalysisMetrics,
  EvaluationOptions,
  EvaluationResult,
} from "@/lib/evaluation/types";

function clampScore(score: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(score * 10) / 10));
}

function contourSimilarity(midi: AnalysisMetrics["midi"]) {
  return midi.essentia_pitch_contour_similarity ?? midi.pitch_contour_similarity ?? 0;
}

function tempoComment(deviation: number | null) {
  if (deviation === null) return "Tempo could not be measured reliably.";
  if (deviation <= 3) return `Tempo closely matches the reference (${deviation}% deviation).`;
  if (deviation <= 8) return `Tempo is slightly off the reference (${deviation}% deviation).`;
  return `Tempo diverges noticeably from the reference (${deviation}% deviation).`;
}

function dynamicsComment(deviation: number | null) {
  if (deviation === null) return "Dynamic range could not be compared reliably.";
  if (deviation <= 3) return "Dynamic contrast is close to the reference performance.";
  if (deviation <= 8) return "Some dynamic contrast is missing compared with the reference.";
  return "Dynamic range differs substantially from the reference.";
}

function accuracyComment(metrics: AnalysisMetrics["midi"]) {
  return `${metrics.note_accuracy_percent}% of reference notes matched (${metrics.wrong_pitch_count} wrong pitches, ${metrics.missing_notes} missing, ${metrics.extra_notes} extra).`;
}

export function buildRuleBasedEvaluation(
  metrics: AnalysisMetrics,
  options: EvaluationOptions,
): EvaluationResult {
  const { midi, audio } = metrics;
  const tempoDev = audio.tempo_deviation_percent;
  const dynDev = audio.dynamics_deviation_db;
  const timingMs = midi.median_timing_error_ms;
  const contour = contourSimilarity(midi);

  if (options.examinerMode === "abrsm") {
    const noteAccuracy = options.checkNoteAccuracy
      ? clampScore((midi.note_accuracy_percent / 100) * 10, 10)
      : 0;
    const tempo = options.checkTempo
      ? clampScore(
          8 - Math.min(8, (tempoDev ?? 25) / 2.5 + timingMs / 60),
          8,
        )
      : 0;
    const dynamics = options.checkDynamics
      ? clampScore(6 - Math.min(6, (dynDev ?? 20) / 2.5), 6)
      : 0;
    const expression = options.checkExpression
      ? clampScore(contour * 6, 6)
      : 0;

    const breakdown: EvaluationResult["scoreBreakdown"] = {};
    if (options.checkNoteAccuracy) {
      breakdown.noteAccuracy = {
        score: noteAccuracy,
        max: 10,
        comment: accuracyComment(midi),
      };
    }
    if (options.checkTempo) {
      breakdown.tempo = { score: tempo, max: 8, comment: tempoComment(tempoDev) };
    }
    if (options.checkDynamics) {
      breakdown.dynamics = { score: dynamics, max: 6, comment: dynamicsComment(dynDev) };
    }
    if (options.checkExpression) {
      breakdown.expression = {
        score: expression,
        max: 6,
        comment: `Phrase shape similarity: ${Math.round(contour * 100)}%.`,
      };
    }

    const totalScore = Object.values(breakdown).reduce((sum, c) => sum + c.score, 0);

    return {
      examinerMode: "abrsm",
      totalScore,
      maxScore: 30,
      scoreBreakdown: breakdown,
      feedback: {
        summary: `Automated analysis of "${options.pieceTitle}" scored ${totalScore}/30 based on MIDI and audio comparison.`,
        strengths: [
          midi.note_accuracy_percent >= 80 ? "Strong note accuracy against the reference" : "",
          (tempoDev ?? 99) <= 5 ? "Steady tempo relative to the reference" : "",
        ].filter(Boolean),
        improvements: [
          midi.note_accuracy_percent < 50
            ? "The performance does not closely match the reference piece"
            : "",
          midi.wrong_pitch_count > 0 ? "Review passages with incorrect pitches" : "",
          (tempoDev ?? 0) > 5 ? "Practice with a metronome against the reference tempo" : "",
          (dynDev ?? 0) > 5 ? "Work on dynamic contrasts" : "",
        ].filter(Boolean),
      },
      analysis: metrics,
    };
  }

  const accuracy = options.checkNoteAccuracy
    ? clampScore((midi.note_accuracy_percent / 100) * 8, 8)
    : 0;
  const fluency = options.checkTempo
    ? clampScore(6 - Math.min(6, timingMs / 80 + (tempoDev ?? 25) / 8), 6)
    : 0;
  const communication = options.checkExpression
    ? clampScore(contour * 4, 4)
    : 0;
  const interpretation = options.checkDynamics
    ? clampScore(4 - Math.min(4, (dynDev ?? 20) / 3), 4)
    : 0;

  const breakdown: EvaluationResult["scoreBreakdown"] = {};
  if (options.checkNoteAccuracy) {
    breakdown.accuracy = { score: accuracy, max: 8, comment: accuracyComment(midi) };
  }
  if (options.checkTempo) {
    breakdown.fluency = {
      score: fluency,
      max: 6,
      comment: `Median timing error: ${timingMs} ms.`,
    };
  }
  if (options.checkExpression) {
    breakdown.communication = {
      score: communication,
      max: 4,
      comment: "Musical communication inferred from pitch contour similarity.",
    };
  }
  if (options.checkDynamics) {
    breakdown.interpretation = {
      score: interpretation,
      max: 4,
      comment: dynamicsComment(dynDev),
    };
  }

  const totalScore = Object.values(breakdown).reduce((sum, c) => sum + c.score, 0);

  return {
    examinerMode: "trinity",
    totalScore,
    maxScore: 22,
    scoreBreakdown: breakdown,
    feedback: {
      summary: `Automated analysis of "${options.pieceTitle}" scored ${totalScore}/22.`,
      strengths: [
        midi.note_accuracy_percent >= 75 ? "Generally secure accuracy" : "",
      ].filter(Boolean),
      improvements: [
        midi.note_accuracy_percent < 50
          ? "The performance does not closely match the reference piece"
          : "",
        midi.missing_notes > 0 ? "Recover missing notes from the reference" : "",
        timingMs > 50 ? "Improve fluency and evenness" : "",
      ].filter(Boolean),
    },
    analysis: metrics,
  };
}
