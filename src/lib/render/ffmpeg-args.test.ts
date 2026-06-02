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
    expect(fc).toContain("concat=n=2:v=1:a=1[vcat][outa]");
  });

  it("scales/crops to the EDL's aspect ratio", () => {
    const args = ffmpegArgsForExport(edl());
    const fc = args[args.indexOf("-filter_complex") + 1];
    const { width, height } = TARGET_SIZES["9:16"];
    expect(fc).toContain(`crop=${width}:${height}`);
    expect(args).toContain("output.mp4");
    expect(args).toContain("libx264");
  });

  it("omits all audio when the source is silent (withAudio:false)", () => {
    const args = ffmpegArgsForExport(edl(), { withAudio: false });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).not.toContain("[0:a]");
    expect(fc).toContain("concat=n=2:v=1:a=0[vcat]");
    expect(args).toContain("-an");
    expect(args).not.toContain("[outa]");
  });

  it("adds the subtitles filter when captions are requested", () => {
    const args = ffmpegArgsForExport(edl(), {
      captions: { srtFile: "subs.srt", fontsDir: "fonts", forceStyle: "FontSize=20" },
    });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("[vcat]subtitles=subs.srt:fontsdir=fonts:force_style='FontSize=20'[vcap]");
    expect(fc).toContain("[vcap]null[outv]");
  });

  it("mixes background music under the speech", () => {
    const args = ffmpegArgsForExport(edl(), {
      music: { path: "song.mp3", volume: 0.3 },
      outputSeconds: 8,
    });
    expect(args).toContain("song.mp3"); // -i song.mp3 (input 1)
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("[1:a]volume=0.3,atrim=0:8");
    expect(fc).toContain("amix=inputs=2");
    expect(args).toContain("[amix]"); // mapped as the output audio
  });

  it("applies master video volume to the speech", () => {
    const args = ffmpegArgsForExport(edl(), { videoVolume: 0.5 });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("[outa]volume=0.500[outav]");
  });

  it("applies auto-enhance to the video and denoise to the audio", () => {
    const args = ffmpegArgsForExport(edl(), { enhance: true, denoise: true });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("[vcat]eq=contrast=1.06");
    expect(fc).toContain("unsharp=");
    expect(fc).toContain("[outa]afftdn[outadn]");
  });

  it("overlays an image at the given position", () => {
    const args = ffmpegArgsForExport(edl(), {
      images: [{ path: "logo.png", x: 50, y: 12 }],
    });
    expect(args).toContain("logo.png"); // input 1 (no music)
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("[1:v]scale=");
    expect(fc).toContain("overlay=x=(W-w)*0.5000:y=(H-h)*0.1200[ov0]");
    expect(fc).toContain("[ov0]null[outv]");
  });

  it("adds intro/outro fade (video + audio) when transition is fade", () => {
    const args = ffmpegArgsForExport(edl(), { transition: "fade", outputSeconds: 8 });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("fade=t=in:st=0:d=0.4");
    expect(fc).toContain("fade=t=out:st=7.60:d=0.4");
    expect(fc).toContain("afade=t=in:st=0:d=0.4");
  });

  it("uses a hard cut (no fade) by default", () => {
    const fc = ffmpegArgsForExport(edl())[
      ffmpegArgsForExport(edl()).indexOf("-filter_complex") + 1
    ];
    expect(fc).not.toContain("fade=");
  });

  it("applies a color filter to the base video before captions", () => {
    const args = ffmpegArgsForExport(edl(), { videoFilter: "hue=s=0" });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("[vcat]hue=s=0[vf]");
    expect(fc).toContain("[vf]null[outv]");
  });

  it("overlays b-roll over a time window", () => {
    const args = ffmpegArgsForExport(edl(), {
      broll: [{ path: "broll.mp4", start: 1, duration: 2 }],
    });
    expect(args).toContain("broll.mp4");
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("setpts=PTS+1/TB");
    expect(fc).toContain("overlay=enable='between(t,1,3.00)'");
  });

  it("orders inputs video → music → images", () => {
    const args = ffmpegArgsForExport(edl(), {
      music: { path: "song.mp3", volume: 0.5 },
      images: [{ path: "logo.png", x: 0, y: 0 }],
      outputSeconds: 8,
    });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("[1:a]volume=0.5"); // music is input 1
    expect(fc).toContain("[2:v]scale="); // image is input 2
  });

  it("throws when nothing is kept", () => {
    const empty: EDL = {
      ...emptyEDL("v"),
      segments: [{ id: "a", start: 0, end: 1, kept: false, text: "x" }],
    };
    expect(() => ffmpegArgsForExport(empty)).toThrow(/nothing to export/i);
  });
});
