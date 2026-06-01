import { describe, expect, it } from "vitest";
import { ffmpegArgsForExport, TARGET_SIZES } from "./ffmpeg-args";
import { emptyEDL, type EDL } from "@/lib/edl/types";

function edl(): EDL {
  return {
    ...emptyEDL("vid-1", "9:16"),
    segments: [
      { id: "s1", start: 0, end: 4, kept: true, text: "hello" },
      { id: "s2", start: 4, end: 5, kept: false, text: "um", reason: "filler" },
      { id: "s3", start: 5, end: 9, kept: true, text: "world" },
    ],
  };
}

describe("ffmpegArgsForExport", () => {
  it("emits a trim per kept segment and concats them", () => {
    const args = ffmpegArgsForExport(edl());
    const fc = args[args.indexOf("-filter_complex") + 1];
    // two kept segments → trims at their source times, removed one skipped
    expect(fc).toContain("trim=start=0:end=4");
    expect(fc).toContain("trim=start=5:end=9");
    expect(fc).not.toContain("end=5,"); // the filler segment is not trimmed
    expect(fc).toContain("concat=n=2:v=1:a=1[outv][outa]");
  });

  it("scales/crops to the EDL's aspect ratio", () => {
    const args = ffmpegArgsForExport(edl());
    const fc = args[args.indexOf("-filter_complex") + 1];
    const { width, height } = TARGET_SIZES["9:16"];
    expect(fc).toContain(`crop=${width}:${height}`);
    expect(args).toContain("output.mp4");
    expect(args).toContain("libx264");
  });

  it("throws when nothing is kept", () => {
    const empty: EDL = {
      ...emptyEDL("v"),
      segments: [{ id: "a", start: 0, end: 1, kept: false, text: "x" }],
    };
    expect(() => ffmpegArgsForExport(empty)).toThrow(/nothing to export/i);
  });
});
