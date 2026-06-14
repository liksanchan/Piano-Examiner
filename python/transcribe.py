"""Transcribe audio to MIDI using Spotify Basic Pitch."""

from __future__ import annotations

import contextlib
import sys
from pathlib import Path

from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH


@contextlib.contextmanager
def _stdout_to_stderr():
    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        yield
    finally:
        sys.stdout = old_stdout


def transcribe_to_midi(wav_path: str | Path, output_dir: str | Path) -> Path:
    wav_path = Path(wav_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    midi_path = output_dir / f"{wav_path.stem}.mid"
    with _stdout_to_stderr():
        _, midi_data, _ = predict(
            str(wav_path),
            ICASSP_2022_MODEL_PATH,
            onset_threshold=0.58,
            frame_threshold=0.38,
            minimum_note_length=100.0,
            melodia_trick=True,
        )
    midi_data.write(str(midi_path))
    return midi_path
