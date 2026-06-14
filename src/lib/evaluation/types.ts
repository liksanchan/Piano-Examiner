import type { ExaminerMode } from "@/lib/db/schema";

export interface CriterionScore {
  score: number;
  max: number;
  comment: string;
}

export interface NoteError {
  type: "wrong" | "missing" | "extra";
  time_seconds: number;
  section: string;
  expected_note: string | null;
  played_note: string | null;
}

export interface SectionStats {
  wrong: number;
  missing: number;
  correct: number;
  ref_notes: number;
}

export interface EvaluationFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  noteErrors?: NoteError[];
  sectionSummary?: Record<string, SectionStats>;
}

export interface EvaluationResult {
  examinerMode: ExaminerMode;
  totalScore: number;
  maxScore: number;
  scoreBreakdown: Record<string, CriterionScore>;
  feedback: EvaluationFeedback;
  analysis?: AnalysisMetrics;
}

export interface MidiMetrics {
  reference_note_count: number;
  student_note_count: number;
  matched_notes: number;
  correct_notes?: number;
  note_accuracy_percent: number;
  wrong_pitch_count: number;
  missing_notes: number;
  extra_notes: number;
  mean_timing_error_ms: number;
  median_timing_error_ms: number;
  pitch_contour_similarity: number | null;
  essentia_pitch_contour_similarity?: number;
  reference_duration_seconds?: number;
  note_errors?: NoteError[];
  section_summary?: Record<string, SectionStats>;
  alignment?: {
    tempo_scale: number;
    time_offset_s: number;
  };
}

export interface AudioFeatureSet {
  bpm: number | null;
  loudness_db: number | null;
  dynamic_range_db: number | null;
  engine: string;
}

export interface AudioComparison {
  reference: AudioFeatureSet;
  student: AudioFeatureSet;
  tempo_deviation_percent: number | null;
  dynamics_deviation_db: number | null;
  loudness_deviation_db: number | null;
  analysis_engine: string;
}

export interface AnalysisMetrics {
  midi: MidiMetrics;
  audio: AudioComparison;
  transcription?: {
    reference_midi: string;
    student_midi: string;
  };
}

export interface EvaluationOptions {
  examinerMode: ExaminerMode;
  pieceTitle: string;
  checkTempo: boolean;
  checkDynamics: boolean;
  checkNoteAccuracy: boolean;
  checkExpression: boolean;
}

export function formatCriterionLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function examinerModeLabel(mode: ExaminerMode) {
  if (mode === "abrsm") return "ABRSM";
  if (mode === "trinity") return "Trinity College London";
  return "Note Accuracy (out of 100)";
}

