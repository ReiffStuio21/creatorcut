/**
 * Pure operations on the EDL. No I/O, no React, no FFmpeg — just data in/data
 * out, so these are trivially unit-testable (see operations.test.ts). Phase 3
 * builds these BEFORE any UI.
 */

import type { EDL, Segment } from "./types";

/** Segments that survive into the final cut, in order. */
export function toKeptSegments(edl: EDL): Segment[] {
  return edl.segments.filter((s) => s.kept);
}

/** Total output duration (sum of kept segment lengths), seconds. */
export function outputDuration(edl: EDL): number {
  return toKeptSegments(edl).reduce((acc, s) => acc + (s.end - s.start), 0);
}

/** Mark a single segment kept/un-kept by id (returns a new EDL). */
export function setSegmentKept(edl: EDL, id: string, kept: boolean): EDL {
  return {
    ...edl,
    segments: edl.segments.map((s) => (s.id === id ? { ...s, kept } : s)),
  };
}

/** Drop every segment auto-flagged as a filler word (returns a new EDL). */
export function applyFillerRemoval(edl: EDL): EDL {
  return {
    ...edl,
    segments: edl.segments.map((s) =>
      s.reason === "filler" ? { ...s, kept: false } : s,
    ),
  };
}

/** Drop every segment auto-flagged as silence (returns a new EDL). */
export function applySilenceRemoval(edl: EDL): EDL {
  return {
    ...edl,
    segments: edl.segments.map((s) =>
      s.reason === "silence" ? { ...s, kept: false } : s,
    ),
  };
}

/** One-click "Clean up": remove both fillers and silences. */
export function applyCleanup(edl: EDL): EDL {
  return applySilenceRemoval(applyFillerRemoval(edl));
}

/** Mark every segment kept (true) or removed (false) — e.g. "Restore all". */
export function setAllKept(edl: EDL, kept: boolean): EDL {
  return { ...edl, segments: edl.segments.map((s) => ({ ...s, kept })) };
}

/**
 * Split a segment at a SOURCE time, creating a manual cut point so a clip can be
 * trimmed/removed at any moment (not just word boundaries). No-op if the time is
 * at/outside the segment's bounds. The first half keeps the text.
 */
export function splitSegment(edl: EDL, id: string, atSourceTime: number): EDL {
  const i = edl.segments.findIndex((s) => s.id === id);
  if (i < 0) return edl;
  const s = edl.segments[i];
  if (atSourceTime <= s.start || atSourceTime >= s.end) return edl;
  const a: Segment = { ...s, id: `${id}-1`, end: atSourceTime };
  const b: Segment = { ...s, id: `${id}-2`, start: atSourceTime, text: "" };
  return {
    ...edl,
    segments: [...edl.segments.slice(0, i), a, b, ...edl.segments.slice(i + 1)],
  };
}

/**
 * Given a SOURCE time, return the nearest source time that is part of the final
 * cut: the same time if it falls inside a kept segment, otherwise the start of
 * the next kept segment. Returns null if nothing kept remains after it. The
 * preview player uses this to skip removed segments during playback.
 */
export function skipToKept(edl: EDL, sourceTime: number): number | null {
  for (const s of toKeptSegments(edl)) {
    if (sourceTime < s.end) {
      return Math.max(sourceTime, s.start);
    }
  }
  return null;
}

/**
 * Trim one edge of a segment to a SOURCE time (drag-to-trim). Clamped so it
 * can't cross the neighbouring segments, invert, or shrink below a minimum.
 * `maxTime` bounds the right edge of the last segment (the video duration).
 */
export function trimSegment(
  edl: EDL,
  id: string,
  edge: "start" | "end",
  t: number,
  maxTime?: number,
): EDL {
  const i = edl.segments.findIndex((s) => s.id === id);
  if (i < 0) return edl;
  const segs = edl.segments;
  const seg = segs[i];
  const MIN = 0.05;
  let { start, end } = seg;
  if (edge === "start") {
    const lo = segs[i - 1] ? segs[i - 1].end : 0;
    start = Math.min(Math.max(t, lo), end - MIN);
  } else {
    const hi = segs[i + 1] ? segs[i + 1].start : (maxTime ?? end);
    end = Math.max(Math.min(t, hi), start + MIN);
  }
  return { ...edl, segments: segs.map((x) => (x.id === id ? { ...x, start, end } : x)) };
}

/**
 * Map a SOURCE time to its position in the OUTPUT (post-cut) timeline — the
 * inverse of {@link outputTimeToSource}. Used to place burned-in captions, whose
 * cues are authored against source time, onto the concatenated output.
 */
export function sourceToOutputTime(edl: EDL, sourceTime: number): number {
  let out = 0;
  for (const s of toKeptSegments(edl)) {
    if (sourceTime >= s.end) {
      out += s.end - s.start;
    } else if (sourceTime <= s.start) {
      return out; // in a removed gap just before this kept segment
    } else {
      return out + (sourceTime - s.start);
    }
  }
  return out; // at/after the end of the cut
}

/**
 * Map an OUTPUT-timeline time back to the SOURCE segment/time, so the preview
 * player can seek the underlying `<video>` while playing only kept segments.
 * Returns null if the time is past the end of the output.
 */
export function outputTimeToSource(
  edl: EDL,
  outputTime: number,
): { segment: Segment; sourceTime: number } | null {
  let elapsed = 0;
  for (const segment of toKeptSegments(edl)) {
    const len = segment.end - segment.start;
    if (outputTime < elapsed + len) {
      return { segment, sourceTime: segment.start + (outputTime - elapsed) };
    }
    elapsed += len;
  }
  return null;
}
