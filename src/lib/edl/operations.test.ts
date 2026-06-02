/**
 * EDL unit tests. Run with `npm test` (Phase 3 wires the test runner).
 * Most portfolio projects have zero tests; the pure-function EDL gives us a
 * real suite for free.
 */

import { describe, expect, it } from "vitest";
import {
  applyCleanup,
  applyFillerRemoval,
  outputDuration,
  outputTimeToSource,
  setAllKept,
  setSegmentKept,
  skipToKept,
  sourceToOutputTime,
  splitSegment,
  toKeptSegments,
  trimSegment,
} from "./operations";
import { edlFromTranscript } from "./from-transcript";
import { emptyEDL, type EDL } from "./types";

function sampleEDL(): EDL {
  return {
    ...emptyEDL("vid-1"),
    segments: [
      { id: "s1", start: 0, end: 4, kept: true, text: "Hey everyone" },
      { id: "s2", start: 4, end: 5, kept: true, text: "um", reason: "filler" },
      { id: "s3", start: 5, end: 9, kept: true, text: "welcome to the channel" },
      { id: "s4", start: 9, end: 11, kept: true, text: "", reason: "silence" },
    ],
  };
}

describe("EDL operations", () => {
  it("toKeptSegments returns only kept segments", () => {
    const edl = setSegmentKept(sampleEDL(), "s3", false);
    expect(toKeptSegments(edl).map((s) => s.id)).toEqual(["s1", "s2", "s4"]);
  });

  it("applyFillerRemoval drops filler segments only", () => {
    const edl = applyFillerRemoval(sampleEDL());
    expect(edl.segments.find((s) => s.id === "s2")?.kept).toBe(false);
    expect(edl.segments.find((s) => s.id === "s4")?.kept).toBe(true);
  });

  it("applyCleanup drops both fillers and silences", () => {
    const kept = toKeptSegments(applyCleanup(sampleEDL())).map((s) => s.id);
    expect(kept).toEqual(["s1", "s3"]);
  });

  it("outputDuration sums kept segment lengths", () => {
    // cleanup keeps s1 (4s) + s3 (4s) = 8s
    expect(outputDuration(applyCleanup(sampleEDL()))).toBe(8);
  });

  it("outputTimeToSource maps across the cut", () => {
    const edl = applyCleanup(sampleEDL()); // kept: s1 [0-4], s3 [5-9]
    expect(outputTimeToSource(edl, 1)).toEqual({
      segment: expect.objectContaining({ id: "s1" }),
      sourceTime: 1,
    });
    // 5s into output = 1s into s3, which starts at source 5 → source 6
    expect(outputTimeToSource(edl, 5)?.sourceTime).toBe(6);
    expect(outputTimeToSource(edl, 99)).toBeNull();
  });

  it("setAllKept restores or removes everything", () => {
    expect(toKeptSegments(setAllKept(applyCleanup(sampleEDL()), true))).toHaveLength(4);
    expect(toKeptSegments(setAllKept(sampleEDL(), false))).toHaveLength(0);
  });

  it("skipToKept stays inside kept regions and jumps over removed ones", () => {
    const edl = applyCleanup(sampleEDL()); // kept source ranges: [0-4], [5-9]
    expect(skipToKept(edl, 2)).toBe(2); // inside kept s1
    expect(skipToKept(edl, 4.5)).toBe(5); // inside removed filler → jump to s3 start
    expect(skipToKept(edl, 10)).toBeNull(); // past the last kept segment
  });

  it("splitSegment splits a clip at a source time", () => {
    const edl = sampleEDL(); // s1 [0-4]
    const out = splitSegment(edl, "s1", 2.5);
    const ids = out.segments.map((s) => s.id);
    expect(ids).toEqual(["s1-1", "s1-2", "s2", "s3", "s4"]);
    const a = out.segments.find((s) => s.id === "s1-1")!;
    const b = out.segments.find((s) => s.id === "s1-2")!;
    expect([a.start, a.end]).toEqual([0, 2.5]);
    expect([b.start, b.end]).toEqual([2.5, 4]);
    expect(a.text).toBe("Hey everyone"); // first half keeps text
    // no-op at the boundary
    expect(splitSegment(edl, "s1", 0).segments).toHaveLength(4);
  });

  it("trimSegment clamps against neighbours and minimum length", () => {
    const edl = sampleEDL(); // s1[0-4] s2[4-5] s3[5-9] s4[9-11]
    // trim s3 start later, but not past its own end
    expect(trimSegment(edl, "s3", "start", 6).segments.find((s) => s.id === "s3")!.start).toBe(6);
    // can't pull s3 start before s2's end (4→ clamps to 5)
    expect(trimSegment(edl, "s3", "start", 2).segments.find((s) => s.id === "s3")!.start).toBe(5);
    // can't push s3 end past s4's start (9)
    expect(trimSegment(edl, "s3", "end", 20).segments.find((s) => s.id === "s3")!.end).toBe(9);
    // last segment's end bounded by maxTime
    expect(trimSegment(edl, "s4", "end", 50, 12).segments.find((s) => s.id === "s4")!.end).toBe(12);
  });

  it("sourceToOutputTime collapses removed time", () => {
    const edl = applyCleanup(sampleEDL()); // kept [0-4]→out[0-4], [5-9]→out[4-8]
    expect(sourceToOutputTime(edl, 2)).toBe(2); // inside first kept segment
    expect(sourceToOutputTime(edl, 4.5)).toBe(4); // inside removed gap → clamp
    expect(sourceToOutputTime(edl, 6)).toBe(5); // 1s into s3 → 4 + 1
    expect(sourceToOutputTime(edl, 99)).toBe(8); // past end → total duration
  });
});

describe("edlFromTranscript", () => {
  it("maps words to kept segments and carries filler/silence reasons", () => {
    const edl = edlFromTranscript(
      {
        provider: "mock",
        mock: true,
        words: [
          { start: 0, end: 1, text: "hello" },
          { start: 1, end: 1.4, text: "um", kind: "filler" },
          { start: 1.4, end: 2.2, text: "—", kind: "silence" },
        ],
      },
      "vid-1",
      "16:9",
    );
    expect(edl.aspectRatio).toBe("16:9");
    expect(edl.segments).toHaveLength(3);
    expect(edl.segments.every((s) => s.kept)).toBe(true);
    expect(edl.segments[0].reason).toBeUndefined();
    expect(edl.segments[1].reason).toBe("filler");
    // a fresh transcript-built EDL cleans up to drop the filler + silence
    expect(toKeptSegments(applyCleanup(edl)).map((s) => s.text)).toEqual(["hello"]);
  });
});
