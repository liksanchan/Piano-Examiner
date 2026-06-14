import type {
  AnalysisMetrics,
  EvaluationOptions,
  EvaluationResult,
} from "@/lib/evaluation/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

function buildPrompt(metrics: AnalysisMetrics, options: EvaluationOptions): string {
  const criteria = [
    options.checkNoteAccuracy && "note accuracy",
    options.checkTempo && "tempo / speed",
    options.checkDynamics && "dynamics",
    options.checkExpression && "expression / articulation",
  ].filter(Boolean);

  return `You are an experienced piano examiner writing feedback for a student performance.

Piece: "${options.pieceTitle}"
Exam board: ${options.examinerMode === "abrsm" ? "ABRSM (total out of 30)" : "Trinity College London (total out of 22)"}
Criteria to assess: ${criteria.join(", ")}

Technical analysis (from Basic Pitch MIDI transcription + Essentia/librosa audio analysis):

${JSON.stringify(metrics, null, 2)}

Write examiner feedback grounded ONLY in these metrics.

Scoring rules (strict — like a real exam):
- If note_accuracy_percent is below 30%, or very few reference notes matched, this is NOT a performance of the piece. Award at most 5/30 (ABRSM) or 4/22 (Trinity) and state clearly that the candidate would fail.
- Random noise, unrelated sounds, or microphone clutter with low note match must receive a fail mark, not a middling score.
- Only award marks above 15/30 when the performance is clearly recognisable as the reference piece.
- Be direct and honest. Do not inflate scores to be encouraging when the metrics show failure.

Return valid JSON with this exact shape:
{
  "totalScore": number,
  "maxScore": number,
  "scoreBreakdown": {
    "<criterionKey>": { "score": number, "max": number, "comment": string }
  },
  "feedback": {
    "summary": string,
    "strengths": string[],
    "improvements": string[]
  }
}

For ABRSM use keys: noteAccuracy (max 10), tempo (max 8), dynamics (max 6), expression (max 6).
For Trinity use keys: accuracy (max 8), fluency (max 6), communication (max 4), interpretation (max 4).
Only include criteria the student enabled: note accuracy=${options.checkNoteAccuracy}, tempo=${options.checkTempo}, dynamics=${options.checkDynamics}, expression=${options.checkExpression}.
Redistribute or omit disabled criteria proportionally but keep maxScore at ${options.examinerMode === "abrsm" ? 30 : 22}.`;
}

function parseGeminiJson(text: string): Omit<EvaluationResult, "examinerMode" | "analysis"> {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Omit<EvaluationResult, "examinerMode" | "analysis">;

  if (
    typeof parsed.totalScore !== "number" ||
    typeof parsed.maxScore !== "number" ||
    !parsed.scoreBreakdown ||
    !parsed.feedback
  ) {
    throw new Error("Gemini returned an invalid evaluation shape.");
  }

  return parsed;
}

export async function generateGeminiReview(
  metrics: AnalysisMetrics,
  options: EvaluationOptions,
): Promise<Omit<EvaluationResult, "examinerMode" | "analysis">> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(metrics, options) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return parseGeminiJson(text);
}

