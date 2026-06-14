"""Audio analysis with Essentia (or librosa fallback on Windows)."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class AudioFeatures:
    bpm: float | None
    loudness_db: float | None
    dynamic_range_db: float | None
    engine: str


def _analyze_with_essentia(wav_path: str) -> AudioFeatures:
    import essentia.standard as es  # type: ignore

    loader = es.MonoLoader(filename=wav_path, sampleRate=44100)
    audio = loader()

    rhythm = es.RhythmExtractor2013(method="multifeature")
    bpm, _, _, _, _ = rhythm(audio)

    loudness_algo = es.LoudnessEBUR128()
    loudness, _, _ = loudness_algo(audio)

    frame_algo = es.FrameGenerator(frameSize=2048, hopSize=1024)
    window = es.Windowing(type="hann")
    rms_algo = es.RMS()
    rms_values = []
    for frame in frame_algo(audio):
        rms_values.append(float(rms_algo(window(frame))))

    dynamic_range = None
    if rms_values:
        rms_db = [20 * __import__("math").log10(max(v, 1e-9)) for v in rms_values]
        dynamic_range = max(rms_db) - min(rms_db)

    return AudioFeatures(
        bpm=round(float(bpm), 2) if bpm else None,
        loudness_db=round(float(loudness), 2) if loudness is not None else None,
        dynamic_range_db=round(float(dynamic_range), 2) if dynamic_range is not None else None,
        engine="essentia",
    )


def _analyze_with_librosa(wav_path: str) -> AudioFeatures:
    import librosa
    import numpy as np

    y, sr = librosa.load(wav_path, sr=22050, mono=True)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(tempo) if hasattr(tempo, "__float__") else float(tempo[0])

    rms = librosa.feature.rms(y=y)[0]
    rms_db = librosa.amplitude_to_db(rms, ref=np.max)
    loudness_db = float(np.mean(rms_db))
    dynamic_range = float(np.max(rms_db) - np.min(rms_db))

    return AudioFeatures(
        bpm=round(bpm, 2),
        loudness_db=round(loudness_db, 2),
        dynamic_range_db=round(dynamic_range, 2),
        engine="librosa",
    )


def analyze_audio(wav_path: str) -> dict:
    try:
        return asdict(_analyze_with_essentia(wav_path))
    except Exception:
        return asdict(_analyze_with_librosa(wav_path))


def compare_audio_features(reference: dict, student: dict) -> dict:
    ref_bpm = reference.get("bpm")
    stu_bpm = student.get("bpm")
    tempo_deviation_percent = None
    if ref_bpm and stu_bpm and ref_bpm > 0:
        tempo_deviation_percent = round(abs(stu_bpm - ref_bpm) / ref_bpm * 100, 2)

    ref_dyn = reference.get("dynamic_range_db")
    stu_dyn = student.get("dynamic_range_db")
    dynamics_deviation_db = None
    if ref_dyn is not None and stu_dyn is not None:
        dynamics_deviation_db = round(abs(stu_dyn - ref_dyn), 2)

    ref_loud = reference.get("loudness_db")
    stu_loud = student.get("loudness_db")
    loudness_deviation_db = None
    if ref_loud is not None and stu_loud is not None:
        loudness_deviation_db = round(abs(stu_loud - ref_loud), 2)

    return {
        "reference": reference,
        "student": student,
        "tempo_deviation_percent": tempo_deviation_percent,
        "dynamics_deviation_db": dynamics_deviation_db,
        "loudness_deviation_db": loudness_deviation_db,
        "analysis_engine": reference.get("engine", "unknown"),
    }


def essentia_midi_similarity(reference_midi: str, student_midi: str) -> dict | None:
    """Use Essentia PitchContourSimilarity on MIDI-derived pitch contours when available."""
    try:
        import essentia.standard as es  # type: ignore
        import numpy as np
        import pretty_midi

        from compare_midi import _collect_notes, _pitch_contour

        ref_notes = _collect_notes(pretty_midi.PrettyMIDI(reference_midi))
        stu_notes = _collect_notes(pretty_midi.PrettyMIDI(student_midi))
        ref_contour = _pitch_contour(ref_notes)
        stu_contour = _pitch_contour(stu_notes)

        if len(ref_contour) < 2 or len(stu_contour) < 2:
            return None

        length = min(len(ref_contour), len(stu_contour))
        similarity = es.PitchContourSimilarity()(ref_contour[:length], stu_contour[:length])
        return {
            "pitch_contour_similarity": round(float(similarity), 4),
            "engine": "essentia",
        }
    except Exception:
        return None
