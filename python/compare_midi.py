"""Compare reference and student MIDI note sequences with tempo-aware alignment."""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pretty_midi

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAX_ERRORS = 80
ONSET_TOLERANCE_S = 0.4
LOOKAHEAD_NOTES = 40
MIN_NOTE_DURATION_S = 0.08
MIN_VELOCITY = 20
DEDUPE_ONSET_S = 0.07
OCTAVE_TOLERANCE = 1


@dataclass
class MidiComparison:
    reference_note_count: int
    student_note_count: int
    matched_notes: int
    correct_notes: int
    note_accuracy_percent: float
    wrong_pitch_count: int
    missing_notes: int
    extra_notes: int
    mean_timing_error_ms: float
    median_timing_error_ms: float
    pitch_contour_similarity: float | None
    reference_duration_seconds: float
    note_errors: list
    section_summary: dict
    alignment: dict


def _pitch_name(pitch: int) -> str:
    return f"{NOTE_NAMES[pitch % 12]}{pitch // 12 - 1}"


def _pitch_class(pitch: int) -> int:
    return pitch % 12


def _pitches_match(ref_pitch: int, stu_pitch: int) -> bool:
    """Match exact pitch or same note name within an octave (Basic Pitch octave errors)."""
    if ref_pitch == stu_pitch:
        return True
    if _pitch_class(ref_pitch) != _pitch_class(stu_pitch):
        return False
    return abs(ref_pitch - stu_pitch) <= 12 * OCTAVE_TOLERANCE


def _clean_notes(notes: list[tuple[float, float, int, int]]) -> list[tuple[float, float, int, int]]:
    """Drop short/quiet transcription artifacts and duplicate onsets."""
    filtered = [
        (start, end, pitch, vel)
        for start, end, pitch, vel in notes
        if (end - start) >= MIN_NOTE_DURATION_S and vel >= MIN_VELOCITY
    ]
    filtered.sort(key=lambda n: (n[0], -n[3], -(n[1] - n[0])))

    cleaned: list[tuple[float, float, int, int]] = []
    for start, end, pitch, vel in filtered:
        if cleaned:
            prev_start, prev_end, prev_pitch, prev_vel = cleaned[-1]
            if pitch == prev_pitch and (start - prev_start) < DEDUPE_ONSET_S:
                cleaned[-1] = (
                    prev_start,
                    max(prev_end, end),
                    pitch,
                    max(prev_vel, vel),
                )
                continue
        cleaned.append((start, end, pitch, vel))
    return cleaned


def _section_label(time_s: float, duration_s: float) -> str:
    if duration_s <= 0:
        return "Unknown"
    pct = (time_s / duration_s) * 100
    if pct < 25:
        return "Opening"
    if pct < 50:
        return "First half"
    if pct < 75:
        return "Second half"
    return "Ending"


def _collect_notes(pm: pretty_midi.PrettyMIDI) -> list[tuple[float, float, int, int]]:
    notes: list[tuple[float, float, int, int]] = []
    for instrument in pm.instruments:
        if instrument.is_drum:
            continue
        for note in instrument.notes:
            notes.append((note.start, note.end, note.pitch, note.velocity))
    return sorted(notes, key=lambda n: n[0])


def _reference_duration(notes: list[tuple[float, float, int, int]]) -> float:
    if not notes:
        return 0.0
    return float(max(end for _, end, _, _ in notes))


def _shift_notes(
    notes: list[tuple[float, float, int, int]],
    offset_s: float,
    scale: float = 1.0,
    anchor: float = 0.0,
) -> list[tuple[float, float, int, int]]:
    return [
        ((start - anchor) * scale + anchor + offset_s, (end - anchor) * scale + anchor + offset_s, pitch, vel)
        for start, end, pitch, vel in notes
    ]


def _warp_student_to_reference(
    ref_notes: list[tuple[float, float, int, int]],
    stu_notes: list[tuple[float, float, int, int]],
) -> tuple[list[tuple[float, float, int, int]], dict]:
    """Align student timeline to reference via tempo scaling + global offset search."""
    if not ref_notes or not stu_notes:
        return stu_notes, {"tempo_scale": 1.0, "time_offset_s": 0.0}

    ref_start = ref_notes[0][0]
    ref_end = max(n[1] for n in ref_notes)
    stu_start = stu_notes[0][0]
    stu_end = max(n[1] for n in stu_notes)

    ref_span = max(ref_end - ref_start, 0.5)
    stu_span = max(stu_end - stu_start, 0.5)
    tempo_scale = ref_span / stu_span

    scaled = [
        ((s - stu_start) * tempo_scale + ref_start, (e - stu_start) * tempo_scale + ref_start, p, v)
        for s, e, p, v in stu_notes
    ]

    def match_quality(
        candidate: list[tuple[float, float, int, int]],
        tolerance: float,
    ) -> tuple[int, float]:
        """Return (pitch-correct hits, mean timing error ms) for monotonic pitch-aware matching."""
        used: set[int] = set()
        hits = 0
        stu_ptr = 0
        timing_errors: list[float] = []
        for r_start, _, r_pitch, _ in ref_notes:
            best_j = None
            best_score = tolerance + 1.0
            search_end = min(len(candidate), stu_ptr + LOOKAHEAD_NOTES)
            for j in range(stu_ptr, search_end):
                if j in used:
                    continue
                s_start, _, s_pitch, _ = candidate[j]
                delta = abs(s_start - r_start)
                if delta > tolerance:
                    continue
                score = delta + (0.0 if _pitches_match(r_pitch, s_pitch) else 10.0)
                if score < best_score:
                    best_score = score
                    best_j = j
            if best_j is None:
                continue
            used.add(best_j)
            stu_ptr = best_j + 1
            s_start, _, s_pitch, _ = candidate[best_j]
            if _pitches_match(r_pitch, s_pitch):
                hits += 1
                timing_errors.append(abs(s_start - r_start) * 1000.0)
        mean_error = float(np.mean(timing_errors)) if timing_errors else float("inf")
        return hits, mean_error

    best_offset = 0.0
    best_hits = -1
    best_error = float("inf")
    for offset in np.arange(-4.0, 4.05, 0.05):
        shifted = _shift_notes(scaled, offset_s=float(offset))
        if any(start < 0 for start, _, _, _ in shifted):
            continue
        hits, mean_error = match_quality(shifted, ONSET_TOLERANCE_S)
        if hits > best_hits or (
            hits == best_hits
            and (mean_error < best_error or (mean_error == best_error and abs(offset) < abs(best_offset)))
        ):
            best_hits = hits
            best_error = mean_error
            best_offset = float(offset)

    aligned = _shift_notes(scaled, offset_s=best_offset)
    cleaned: list[tuple[float, float, int, int]] = []
    for start, end, pitch, vel in aligned:
        start = max(0.0, start)
        end = max(start + 0.01, end)
        cleaned.append((start, end, pitch, vel))
    return cleaned, {
        "tempo_scale": round(tempo_scale, 4),
        "time_offset_s": round(best_offset, 3),
    }


def _candidate_indices(
    stu_notes: list[tuple[float, float, int, int]],
    used: set[int],
    stu_ptr: int,
    r_start: float,
    tolerance_s: float,
) -> list[tuple[int, float]]:
    """Student indices within onset tolerance, preserving performance order."""
    search_end = min(len(stu_notes), stu_ptr + LOOKAHEAD_NOTES)
    candidates: list[tuple[int, float]] = []
    for j in range(stu_ptr, search_end):
        if j in used:
            continue
        s_start = stu_notes[j][0]
        delta = abs(s_start - r_start)
        if delta <= tolerance_s:
            candidates.append((j, delta))
    return candidates


def _monotonic_match(
    ref_notes: list[tuple[float, float, int, int]],
    stu_notes: list[tuple[float, float, int, int]],
    tolerance_s: float,
) -> tuple[list[tuple[int, int, bool]], set[int]]:
    """
    Two-pass monotonic matching:
    1) Pair pitch-class matches first (avoids ghost reference notes stealing correct notes).
    2) Pair remaining nearby notes as wrong-pitch mistakes.
    """
    used: set[int] = set()
    matched_ref: dict[int, tuple[int, bool]] = {}
    stu_ptr = 0

    for ri, (r_start, _, r_pitch, _) in enumerate(ref_notes):
        candidates = _candidate_indices(stu_notes, used, stu_ptr, r_start, tolerance_s)
        pitch_matches = [
            (j, delta)
            for j, delta in candidates
            if _pitches_match(r_pitch, stu_notes[j][2])
        ]
        if not pitch_matches:
            continue
        best_j, _ = min(pitch_matches, key=lambda item: item[1])
        used.add(best_j)
        stu_ptr = best_j + 1
        matched_ref[ri] = (best_j, True)

    stu_ptr = 0
    for ri, (r_start, _, r_pitch, _) in enumerate(ref_notes):
        if ri in matched_ref:
            stu_ptr = max(stu_ptr, matched_ref[ri][0] + 1)
            continue

        candidates = _candidate_indices(stu_notes, used, stu_ptr, r_start, tolerance_s)
        if not candidates:
            continue

        best_j, _ = min(candidates, key=lambda item: item[1])
        used.add(best_j)
        stu_ptr = best_j + 1
        matched_ref[ri] = (best_j, False)

    matches = [(ri, sj, ok) for ri, (sj, ok) in sorted(matched_ref.items())]
    return matches, used


def _pitch_contour(notes: list[tuple[float, float, int, int]], hop: float = 0.05) -> np.ndarray:
    if not notes:
        return np.array([], dtype=float)
    end_time = max(n[1] for n in notes)
    times = np.arange(0, end_time + hop, hop)
    contour = np.zeros(len(times), dtype=float)
    for i, t in enumerate(times):
        active = [n[2] for n in notes if n[0] <= t < n[1]]
        contour[i] = float(np.mean(active)) if active else 0.0
    return contour


def _contour_similarity(a: np.ndarray, b: np.ndarray) -> float | None:
    if len(a) == 0 or len(b) == 0:
        return None
    length = min(len(a), len(b))
    if length < 2:
        return None
    a_trim = a[:length]
    b_trim = b[:length]
    mask = (a_trim > 0) & (b_trim > 0)
    if mask.sum() < 2:
        return None
    corr = np.corrcoef(a_trim[mask], b_trim[mask])[0, 1]
    if np.isnan(corr):
        return None
    return float(max(0.0, min(1.0, (corr + 1) / 2)))


def compare_midi_files(
    reference_midi: str,
    student_midi: str,
    onset_tolerance_s: float = ONSET_TOLERANCE_S,
) -> dict:
    ref_pm = pretty_midi.PrettyMIDI(reference_midi)
    stu_pm = pretty_midi.PrettyMIDI(student_midi)

    ref_notes = _clean_notes(_collect_notes(ref_pm))
    stu_notes_raw = _clean_notes(_collect_notes(stu_pm))
    duration = _reference_duration(ref_notes)

    aligned_stu, alignment_meta = _warp_student_to_reference(ref_notes, stu_notes_raw)
    matches, used_student = _monotonic_match(ref_notes, aligned_stu, onset_tolerance_s)

    matched_ref_indices = {m[0] for m in matches}
    correct = sum(1 for _, _, ok in matches if ok)
    wrong_pitch = sum(1 for _, _, ok in matches if not ok)
    matched = len(matches)
    missing = max(0, len(ref_notes) - len(matched_ref_indices))
    extra = max(0, len(stu_notes_raw) - len(used_student))

    timing_errors: list[float] = []
    note_errors: list[dict] = []

    section_summary: dict[str, dict[str, int]] = {
        "Opening": {"wrong": 0, "missing": 0, "correct": 0, "ref_notes": 0},
        "First half": {"wrong": 0, "missing": 0, "correct": 0, "ref_notes": 0},
        "Second half": {"wrong": 0, "missing": 0, "correct": 0, "ref_notes": 0},
        "Ending": {"wrong": 0, "missing": 0, "correct": 0, "ref_notes": 0},
    }

    def bump_section(section: str, key: str) -> None:
        if section in section_summary:
            section_summary[section][key] += 1

    for ri, (ref_start, _, ref_pitch, _) in enumerate(ref_notes):
        section = _section_label(ref_start, duration)
        bump_section(section, "ref_notes")

    for ri, sj, pitch_ok in matches:
        ref_start, _, ref_pitch, _ = ref_notes[ri]
        stu_start, _, stu_pitch, _ = aligned_stu[sj]
        section = _section_label(ref_start, duration)
        timing_errors.append(abs(stu_start - ref_start) * 1000)

        if pitch_ok:
            bump_section(section, "correct")
        else:
            bump_section(section, "wrong")
            if len(note_errors) < MAX_ERRORS:
                note_errors.append(
                    {
                        "type": "wrong",
                        "time_seconds": round(ref_start, 2),
                        "section": section,
                        "expected_note": _pitch_name(ref_pitch),
                        "played_note": _pitch_name(stu_pitch),
                    }
                )

    for ri, (ref_start, _, ref_pitch, _) in enumerate(ref_notes):
        if ri in matched_ref_indices:
            continue
        section = _section_label(ref_start, duration)
        bump_section(section, "missing")
        if len(note_errors) < MAX_ERRORS:
            note_errors.append(
                {
                    "type": "missing",
                    "time_seconds": round(ref_start, 2),
                    "section": section,
                    "expected_note": _pitch_name(ref_pitch),
                    "played_note": None,
                }
            )

    for idx, (stu_start, _, stu_pitch, _) in enumerate(aligned_stu):
        if idx in used_student:
            continue
        section = _section_label(stu_start, duration)
        if len(note_errors) < MAX_ERRORS:
            note_errors.append(
                {
                    "type": "extra",
                    "time_seconds": round(stu_start, 2),
                    "section": section,
                    "expected_note": None,
                    "played_note": _pitch_name(stu_pitch),
                }
            )

    accuracy = (correct / len(ref_notes) * 100.0) if ref_notes else 0.0

    ref_contour = _pitch_contour(ref_notes)
    stu_contour = _pitch_contour(aligned_stu)
    contour_sim = _contour_similarity(ref_contour, stu_contour)

    note_errors.sort(key=lambda e: e["time_seconds"])

    result = MidiComparison(
        reference_note_count=len(ref_notes),
        student_note_count=len(stu_notes_raw),
        matched_notes=matched,
        correct_notes=correct,
        note_accuracy_percent=round(accuracy, 2),
        wrong_pitch_count=wrong_pitch,
        missing_notes=missing,
        extra_notes=extra,
        mean_timing_error_ms=round(float(np.mean(timing_errors)), 2) if timing_errors else 0.0,
        median_timing_error_ms=round(float(np.median(timing_errors)), 2) if timing_errors else 0.0,
        pitch_contour_similarity=round(contour_sim, 4) if contour_sim is not None else None,
        reference_duration_seconds=round(duration, 2),
        note_errors=note_errors,
        section_summary=section_summary,
        alignment=alignment_meta,
    )
    return asdict(result)
