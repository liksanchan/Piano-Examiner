import type { AnalysisMetrics, EvaluationOptions, EvaluationResult } from "@/lib/evaluation/types";
import type { NoteError } from "@/lib/evaluation/types";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sectionAdvice(section: string, wrong: number, missing: number) {
  if (wrong === 0 && missing === 0) return null;
  const issues: string[] = [];
  if (wrong > 0) issues.push(`${wrong} wrong note${wrong === 1 ? "" : "s"}`);
  if (missing > 0) issues.push(`${missing} missing note${missing === 1 ? "" : "s"}`);
  return `${section}: ${issues.join(", ")}`;
}

export function buildAccuracy100Evaluation(
  metrics: AnalysisMetrics,
  options: EvaluationOptions,
): EvaluationResult {
  const { midi } = metrics;
  const score = Math.round(midi.note_accuracy_percent * 10) / 10;
  const noteErrors = midi.note_errors ?? [];

  const sectionLines = Object.entries(midi.section_summary ?? {})
    .map(([section, stats]) =>
      sectionAdvice(section, stats.wrong, stats.missing),
    )
    .filter((line): line is string => Boolean(line));

  const summary =
    score >= 85
      ? `Strong note accuracy (${score}/100) on "${options.pieceTitle}".`
      : score >= 60
        ? `Moderate note accuracy (${score}/100) on "${options.pieceTitle}". Review the sections below.`
        : score >= 30
          ? `Low note accuracy (${score}/100). Several passages do not match the reference.`
          : `Very low note accuracy (${score}/100). This performance does not closely match the reference notes.`;

  const improvements: string[] = [...sectionLines];
  if (midi.missing_notes > 0) {
    improvements.push(
      `${midi.missing_notes} reference note${midi.missing_notes === 1 ? "" : "s"} were not heard in your recording.`,
    );
  }
  if (midi.extra_notes > 0) {
    improvements.push(
      `${midi.extra_notes} extra note${midi.extra_notes === 1 ? "" : "s"} were detected that are not in the reference.`,
    );
  }
  if (improvements.length === 0) {
    improvements.push("Keep practising to maintain accuracy at full tempo.");
  }

  return {
    examinerMode: "accuracy100",
    totalScore: score,
    maxScore: 100,
    scoreBreakdown: {
      noteAccuracy: {
        score,
        max: 100,
        comment: `${midi.correct_notes} of ${midi.reference_note_count} reference notes were correct (${score}%).`,
      },
    },
    feedback: {
      summary,
      strengths:
        score >= 80
          ? [`${midi.correct_notes} notes matched the reference pitch.`]
          : [],
      improvements,
      noteErrors,
      sectionSummary: midi.section_summary,
    },
  };
}

export function formatNoteError(error: NoteError) {
  const time = formatTime(error.time_seconds);
  if (error.type === "wrong") {
    return `At ${time} (${error.section}) — expected ${error.expected_note}, played ${error.played_note}`;
  }
  if (error.type === "missing") {
    return `At ${time} (${error.section}) — missing ${error.expected_note}`;
  }
  return `At ${time} (${error.section}) — extra note ${error.played_note}`;
}
