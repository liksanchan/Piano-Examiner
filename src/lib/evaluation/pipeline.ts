import path from "path";
import type { Performance, Piece } from "@/lib/db/schema";
import { getUploadDir } from "@/lib/db/paths";
import { buildAccuracy100Evaluation } from "@/lib/evaluation/accuracy100";
import { calibrateEvaluation } from "@/lib/evaluation/calibrate";
import { generateGeminiReview } from "@/lib/evaluation/gemini";
import { runAnalysisPipeline } from "@/lib/evaluation/python-pipeline";
import { buildRuleBasedEvaluation } from "@/lib/evaluation/rules";
import type { EvaluationOptions, EvaluationResult } from "@/lib/evaluation/types";

function resolveAudioPath(relativePath: string): string {
  return path.join(getUploadDir(), relativePath);
}

export async function evaluatePerformance(
  performance: Performance,
  piece: Piece,
): Promise<EvaluationResult> {
  if (!piece.referenceAudioPath) {
    throw new Error("This song has no reference audio. Upload a reference recording first.");
  }

  const options: EvaluationOptions = {
    examinerMode: performance.examinerMode,
    pieceTitle: piece.title,
    checkTempo: performance.checkTempo,
    checkDynamics: performance.checkDynamics,
    checkNoteAccuracy: performance.checkNoteAccuracy,
    checkExpression: performance.checkExpression,
  };

  const metrics = await runAnalysisPipeline(
    resolveAudioPath(piece.referenceAudioPath),
    resolveAudioPath(performance.audioPath),
  );

  let result: EvaluationResult;

  if (options.examinerMode === "accuracy100") {
    result = buildAccuracy100Evaluation(metrics, options);
    return calibrateEvaluation(result, metrics, options.pieceTitle);
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const gemini = await generateGeminiReview(metrics, options);
      result = {
        examinerMode: options.examinerMode,
        ...gemini,
        analysis: metrics,
      };
    } catch (error) {
      console.error("Gemini review failed, using rule-based scoring:", error);
      result = buildRuleBasedEvaluation(metrics, options);
    }
  } else {
    console.warn("GEMINI_API_KEY not set — using rule-based scoring from analysis metrics.");
    result = buildRuleBasedEvaluation(metrics, options);
  }

  return calibrateEvaluation(result, metrics, options.pieceTitle);
}

