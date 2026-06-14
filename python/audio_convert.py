"""Convert uploaded audio (webm, mp3, etc.) to WAV for Basic Pitch and Essentia."""

from __future__ import annotations

import tempfile
from pathlib import Path

from pydub import AudioSegment


def to_wav(input_path: str | Path, output_dir: str | Path | None = None) -> Path:
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Audio file not found: {input_path}")

    out_dir = Path(output_dir) if output_dir else Path(tempfile.gettempdir())
    out_dir.mkdir(parents=True, exist_ok=True)
    wav_path = out_dir / f"{input_path.stem}_converted.wav"

    audio = AudioSegment.from_file(str(input_path))
    audio = audio.set_channels(1).set_frame_rate(22050)
    audio.export(str(wav_path), format="wav")
    return wav_path
