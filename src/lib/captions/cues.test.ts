import { describe, expect, it } from "vitest";
import { activeCue, buildCaptionCues } from "./cues";
import { emptyEDL, type EDL } from "@/lib/edl/types";

function edlWith(segments: EDL["segments"]): EDL {
  return { ...emptyEDL("vid-1"), segments };
}

describe("buildCaptionCues", () => {
  it("groups kept words into lines up to maxWords", () => {
    const edl = edlWith(
      Array.from({ length: 8 }, (_, i) => ({
        id: `w${i}`,
        start: i,
        end: i + 0.5,
        kept: true,
        text: `w${i}`,
      })),
    );
    const cues = buildCaptionCues(edl, { maxWords: 3, maxGapSeconds: 10 });
    expect(cues).toHaveLength(3); // 3 + 3 + 2
    expect(cues[0].text).toBe("w0 w1 w2");
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(2.5);
  });

  it("breaks a line on a large gap and skips silence/removed words", () => {
    const edl = edlWith([
      { id: "a", start: 0, end: 1, kept: true, text: "hello" },
      { id: "b", start: 1, end: 1.6, kept: true, text: "there" },
      { id: "s", start: 1.6, end: 2.6, kept: true, text: "—", reason: "silence" },
      { id: "c", start: 5, end: 6, kept: true, text: "world" },
      { id: "d", start: 6, end: 7, kept: false, text: "dropped" },
    ]);
    const cues = buildCaptionCues(edl, { maxWords: 10, maxGapSeconds: 0.4 });
    expect(cues.map((c) => c.text)).toEqual(["hello there", "world"]);
  });

  it("activeCue finds the cue at a source time", () => {
    const cues = [
      { start: 0, end: 2, text: "one" },
      { start: 2, end: 4, text: "two" },
    ];
    expect(activeCue(cues, 1)?.text).toBe("one");
    expect(activeCue(cues, 3)?.text).toBe("two");
    expect(activeCue(cues, 9)).toBeNull();
  });
});
