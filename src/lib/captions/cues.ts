/**
 * Caption cues derived from the EDL (Phase 4). Each cue is a short line shown
 * over a SOURCE-time window — keyed to source time because the preview plays the
 * source and skips removed segments, so source time is what the <video> exposes.
 *
 * Pure function → unit-testable (see cues.test.ts).
 */

import type { EDL } from "@/lib/edl/types";
import { toKeptSegments } from "@/lib/edl/operations";

export interface CaptionCue {
  /** SOURCE-time window, seconds */
  start: number;
  end: number;
  text: string;
}

interface BuildOptions {
  /** max words per caption line */
  maxWords?: number;
  /** a gap larger than this (seconds) between kept words breaks the line */
  maxGapSeconds?: number;
}

export function buildCaptionCues(
  edl: EDL,
  { maxWords = 6, maxGapSeconds = 0.4 }: BuildOptions = {},
): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let buf: { start: number; end: number; text: string }[] = [];
  let lastEnd: number | null = null;

  const flush = () => {
    if (buf.length === 0) return;
    cues.push({
      start: buf[0].start,
      end: buf[buf.length - 1].end,
      text: buf.map((w) => w.text).join(" "),
    });
    buf = [];
  };

  for (const seg of toKeptSegments(edl)) {
    const text = seg.text.trim();
    // silence/empty/placeholder tokens break the line but carry no caption text
    if (seg.reason === "silence" || text === "" || text === "—") {
      flush();
      lastEnd = seg.end;
      continue;
    }
    const discontinuous = lastEnd !== null && seg.start - lastEnd > maxGapSeconds;
    if (buf.length > 0 && (discontinuous || buf.length >= maxWords)) {
      flush();
    }
    buf.push({ start: seg.start, end: seg.end, text });
    lastEnd = seg.end;
  }
  flush();

  return cues;
}

/** The cue active at a given SOURCE time, or null. */
export function activeCue(cues: CaptionCue[], sourceTime: number): CaptionCue | null {
  for (const cue of cues) {
    if (sourceTime >= cue.start && sourceTime < cue.end) return cue;
  }
  return null;
}
