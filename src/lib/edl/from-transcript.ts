/**
 * Build an EDL from a transcript (Phase 3). Each transcript word becomes a
 * segment, so deleting a word in the UI flips that segment's `kept` flag and the
 * preview/renderer drop it. Auto-tagged fillers/silences carry their reason so
 * one-click "Clean up" can target them.
 */

import type { Transcript } from "@/lib/transcription/provider";
import type { AspectRatio, EDL, Segment } from "./types";
import { emptyEDL } from "./types";

export function edlFromTranscript(
  transcript: Transcript,
  source: string,
  aspectRatio: AspectRatio = "9:16",
): EDL {
  const segments: Segment[] = transcript.words.map((w, i) => ({
    id: `w${i}`,
    start: w.start,
    end: w.end,
    kept: true,
    text: w.text,
    // map transcript word.kind → segment.reason (undefined for normal speech)
    ...(w.kind ? { reason: w.kind } : {}),
  }));

  return { ...emptyEDL(source, aspectRatio), segments };
}
