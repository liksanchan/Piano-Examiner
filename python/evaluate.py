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
import shutil
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


def _skipped_audio_comparison() -> dict:
    empty = {"bpm": None, "loudness_db": None, "dynamic_range_db": None, "engine": "skipped"}
    return {
        "reference": empty,
        "student": empty,
        "tempo_deviation_percent": None,
        "dynamics_deviation_db": None,
        "loudness_deviation_db": None,
        "analysis_engine": "skipped",
    }


def evaluate(
    reference_audio: str,
    student_audio: str,
    *,
    reference_midi: str | None = None,
    reference_midi_cache: str | None = None,
    skip_audio_analysis: bool = False,
) -> dict:
    work_dir = Path(tempfile.mkdtemp(prefix="piano-examiner-"))

    cached_ref = bool(reference_midi and Path(reference_midi).is_file())
    need_ref_wav = not skip_audio_analysis
    need_ref_transcribe = not cached_ref

    ref_wav: Path | None = None
    if need_ref_wav or need_ref_transcribe:
        ref_wav = to_wav(reference_audio, work_dir)

    stu_wav = to_wav(student_audio, work_dir)

    if cached_ref:
        ref_midi = Path(reference_midi)
    else:
        ref_midi = transcribe_to_midi(ref_wav, work_dir)
        if reference_midi_cache:
            cache_path = Path(reference_midi_cache)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ref_midi, cache_path)

    stu_midi = transcribe_to_midi(stu_wav, work_dir)

    midi_metrics = compare_midi_files(str(ref_midi), str(stu_midi))
    essentia_midi = essentia_midi_similarity(str(ref_midi), str(stu_midi))
    if essentia_midi:
        midi_metrics["essentia_pitch_contour_similarity"] = essentia_midi[
            "pitch_contour_similarity"
        ]

    if skip_audio_analysis:
        audio_comparison = _skipped_audio_comparison()
    else:
        if ref_wav is None:
            ref_wav = to_wav(reference_audio, work_dir)
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
    parser.add_argument(
        "--reference-midi",
        help="Pre-transcribed reference MIDI (skips Basic Pitch on reference when file exists)",
    )
    parser.add_argument(
        "--reference-midi-cache",
        help="Write reference MIDI here after first transcription for reuse",
    )
    parser.add_argument(
        "--skip-audio-analysis",
        action="store_true",
        help="Skip librosa/Essentia tempo and dynamics analysis",
    )
    args = parser.parse_args()

    try:
        with _quiet_pipeline_output():
            result = evaluate(
                args.reference,
                args.student,
                reference_midi=args.reference_midi,
                reference_midi_cache=args.reference_midi_cache,
                skip_audio_analysis=args.skip_audio_analysis,
            )
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
