import type { ExaminerMode } from "@/lib/db/schema";

import type { EvaluationResult } from "@/lib/evaluation/types";



export type { CriterionScore, EvaluationResult } from "@/lib/evaluation/types";

export { formatCriterionLabel, examinerModeLabel } from "@/lib/evaluation/types";



export function buildMockEvaluation(mode: ExaminerMode): EvaluationResult {
  if (mode === "accuracy100") {
    return {
      examinerMode: "accuracy100",
      totalScore: 72,
      maxScore: 100,
      scoreBreakdown: {
        noteAccuracy: {
          score: 72,
          max: 100,
          comment: "72 of 100 reference notes were correct (72%).",
        },
      },
      feedback: {
        summary: "Moderate note accuracy (72/100). Review the sections below.",
        strengths: ["Most notes in the opening matched the reference."],
        improvements: ["Second half: 3 wrong notes, 2 missing notes"],
        noteErrors: [
          {
            type: "wrong",
            time_seconds: 45,
            section: "Second half",
            expected_note: "C4",
            played_note: "D4",
          },
          {
            type: "missing",
            time_seconds: 52,
            section: "Second half",
            expected_note: "E4",
            played_note: null,
          },
        ],
        sectionSummary: {
          Opening: { wrong: 0, missing: 0, correct: 20, ref_notes: 20 },
          "First half": { wrong: 2, missing: 1, correct: 25, ref_notes: 28 },
          "Second half": { wrong: 3, missing: 2, correct: 18, ref_notes: 23 },
          Ending: { wrong: 1, missing: 0, correct: 9, ref_notes: 10 },
        },
      },
    };
  }

  if (mode === "abrsm") {

    const breakdown = {

      noteAccuracy: {

        score: 7,

        max: 10,

        comment: "Generally accurate with minor slips in the middle section.",

      },

      tempo: {

        score: 6,

        max: 8,

        comment: "Slightly rushed in passages marked allegro.",

      },

      dynamics: {

        score: 5,

        max: 6,

        comment: "Good contrast; crescendo in bar 12 could be more pronounced.",

      },

      expression: {

        score: 5,

        max: 6,

        comment: "Phrasing is musical; pedalling mostly appropriate.",

      },

    };

    const totalScore = Object.values(breakdown).reduce(

      (sum, c) => sum + c.score,

      0,

    );

    return {

      examinerMode: mode,

      totalScore,

      maxScore: 30,

      scoreBreakdown: breakdown,

      feedback: {

        summary:

          "A confident performance showing musical understanding. Focus on steadier tempo in fast passages.",

        strengths: [

          "Clear articulation",

          "Good dynamic awareness",

          "Secure memory",

        ],

        improvements: [

          "Maintain tempo in allegro sections",

          "Sharpen accuracy in middle passage",

          "Deepen crescendo contrasts",

        ],

      },

    };

  }



  const breakdown = {

    accuracy: {

      score: 6,

      max: 8,

      comment: "Mostly secure with occasional note substitutions.",

    },

    fluency: {

      score: 5,

      max: 6,

      comment: "Flow is good; a few hesitations disrupt continuity.",

    },

    communication: {

      score: 4,

      max: 4,

      comment: "Expressive playing with clear character.",

    },

    interpretation: {

      score: 4,

      max: 4,

      comment: "Style appropriate to the period.",

    },

  };

  const totalScore = Object.values(breakdown).reduce(

    (sum, c) => sum + c.score,

    0,

  );



  return {

    examinerMode: mode,

    totalScore,

    maxScore: 22,

    scoreBreakdown: breakdown,

    feedback: {

      summary:

        "An engaging performance with strong communication. Work on fluency through technically demanding passages.",

      strengths: ["Musical communication", "Appropriate stylistic choices"],

      improvements: [

        "Smoother fluency in runs",

        "Greater note security under pressure",

      ],

    },

  };

}


