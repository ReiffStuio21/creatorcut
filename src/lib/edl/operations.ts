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
