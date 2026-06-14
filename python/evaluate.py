#!/usr/bin/env python3
"""
Evaluate a piano performance against a reference recording.

Pipeline:
  1. Convert audio to WAV
  2. Spotify Basic Pitch -> MIDI for reference and student
  3. Compare MIDI note sequences + Essentia pitch contour similarity
  4. Essentia (or librosa) audio analysis for tempo/dynamics
  5. Print JSON metrics to stdout for the Next.js API
"""

from __future__ import annotations

import argparse
import contextlib
import json
import logging
import sys
import tempfile
import traceback
import warnings
from pathlib import Path


@contextlib.contextmanager
def _quiet_pipeline_output():
    """Keep stdout clean for JSON — route library prints to stderr."""
    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    warnings.filterwarnings("ignore", category=UserWarning)
    logging.getLogger().setLevel(logging.ERROR)
    try:
        yield
    finally:
        sys.stdout = old_stdout

from audio_convert import to_wav
from compare_midi import compare_midi_files
from essentia_analysis import analyze_audio, compare_audio_features, essentia_midi_similarity
from transcribe import transcribe_to_midi


def evaluate(reference_audio: str, student_audio: str) -> dict:
    work_dir = Path(tempfile.mkdtemp(prefix="piano-examiner-"))

    ref_wav = to_wav(reference_audio, work_dir)
    stu_wav = to_wav(student_audio, work_dir)

    ref_midi = transcribe_to_midi(ref_wav, work_dir)
    stu_midi = transcribe_to_midi(stu_wav, work_dir)

    midi_metrics = compare_midi_files(str(ref_midi), str(stu_midi))
    essentia_midi = essentia_midi_similarity(str(ref_midi), str(stu_midi))
    if essentia_midi:
        midi_metrics["essentia_pitch_contour_similarity"] = essentia_midi[
            "pitch_contour_similarity"
        ]

    ref_audio = analyze_audio(str(ref_wav))
    stu_audio = analyze_audio(str(stu_wav))
    audio_comparison = compare_audio_features(ref_audio, stu_audio)

    return {
        "midi": midi_metrics,
        "audio": audio_comparison,
        "transcription": {
            "reference_midi": str(ref_midi),
            "student_midi": str(stu_midi),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Piano performance analysis pipeline")
    parser.add_argument("--reference", required=True, help="Path to reference audio file")
    parser.add_argument("--student", required=True, help="Path to student performance audio")
    args = parser.parse_args()

    try:
        with _quiet_pipeline_output():
            result = evaluate(args.reference, args.student)
        json.dump(result, sys.stdout)
        sys.stdout.write("\n")
        return 0
    except Exception as exc:
        json.dump(
            {
                "error": str(exc),
                "traceback": traceback.format_exc(),
            },
            sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
