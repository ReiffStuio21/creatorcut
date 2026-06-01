import { describe, expect, it } from "vitest";
import { buildForceStyle, buildOutputCues, hexToAssColor, toSrt } from "./srt";
import { emptyEDL, type EDL } from "@/lib/edl/types";

function edl(): EDL {
  return {
    ...emptyEDL("v"),
    segments: [
      { id: "a", start: 0, end: 1, kept: true, text: "hello" },
      { id: "b", start: 1, end: 1.6, kept: true, text: "there" },
      { id: "c", start: 1.6, end: 3, kept: false, text: "cut", reason: "filler" },
      { id: "d", start: 3, end: 4, kept: true, text: "world" },
    ],
  };
}

describe("caption SRT", () => {
  it("remaps cues to output time (removed time collapsed)", () => {
    const cues = buildOutputCues(edl());
    // "hello there" 0–1.6 stays; "world" was source 3–4 → output 1.6–2.6
    expect(cues).toEqual([
      { start: 0, end: 1.6, text: "hello there" },
      { start: 1.6, end: 2.6, text: "world" },
    ]);
  });

  it("formats SRT with index, timecodes and text", () => {
    const srt = toSrt([{ start: 0, end: 1.6, text: "hello there" }]);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:01,600\nhello there");
  });

  it("converts hex colors to ASS BGR", () => {
    expect(hexToAssColor("#FFFFFF")).toBe("&H00FFFFFF");
    expect(hexToAssColor("#FACC15")).toBe("&H0015CCFA");
  });

  it("builds force_style reflecting the style preset", () => {
    expect(buildForceStyle({ enabled: true, style: "boxed-center", color: "#FFFFFF" })).toContain(
      "BorderStyle=3",
    );
    expect(buildForceStyle({ enabled: true, style: "bold-bottom", color: "#FFFFFF" })).toContain(
      "Bold=-1",
    );
  });
});
