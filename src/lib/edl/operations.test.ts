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
  setSegmentKept,
  toKeptSegments,
} from "./operations";
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
});
