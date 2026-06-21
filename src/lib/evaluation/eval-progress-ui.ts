export interface EvalProgressStage {
  afterSeconds: number;
  label: string;
}

export const EVAL_PROGRESS_STAGES: EvalProgressStage[] = [
  { afterSeconds: 0, label: "Preparing audio…" },
  { afterSeconds: 3, label: "Transcribing notes…" },
  { afterSeconds: 20, label: "Comparing performance…" },
  { afterSeconds: 45, label: "Generating feedback…" },
  { afterSeconds: 90, label: "Still working — free hosting can be slow for longer clips…" },
];

export function getEvalProgressStage(elapsedSeconds: number): string {
  let label = EVAL_PROGRESS_STAGES[0]!.label;
  for (const stage of EVAL_PROGRESS_STAGES) {
    if (elapsedSeconds >= stage.afterSeconds) {
      label = stage.label;
    }
  }
  return label;
}

/** Rough wait hint based on recording length (seconds). */
export function getEvalTimeHint(recordingSeconds: number | null): string {
  if (recordingSeconds === null || recordingSeconds <= 0) {
    return "Usually 1–2 min on free hosting; shorter clips finish faster.";
  }
  if (recordingSeconds <= 60) {
    return "Usually 1–2 min for a clip this length.";
  }
  if (recordingSeconds <= 120) {
    return "Usually 2–3 min for a clip this length.";
  }
  return "Longer clips can take 3+ min on free hosting — a shorter take may help.";
}
