/**
 * Pure translation of an EDL into FFmpeg arguments (Phase 6). Kept separate from
 * the wasm runtime so it can be unit-tested without loading FFmpeg.
 *
 * Strategy: for each kept segment, trim video+audio and reset timestamps, scale
 * to fill the target frame and center-crop (uniform size is required so the
 * segments can be concatenated), then concat all segments into one stream.
 * Caption burn-in is a follow-on within Phase 6 (needs a libass-enabled core).
 */

import type { AspectRatio, CostEstimate, EDL } from "@/lib/edl/types";
import { outputDuration, toKeptSegments } from "@/lib/edl/operations";

export interface TargetSize {
  width: number;
  height: number;
}

// 720-class targets keep browser (wasm) encoding tractable.
export const TARGET_SIZES: Record<AspectRatio, TargetSize> = {
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 720, height: 720 },
  "16:9": { width: 1280, height: 720 },
};

export const INPUT_NAME = "input.mp4";
export const OUTPUT_NAME = "output.mp4";

export interface CaptionBurn {
  /** SRT path written into the FFmpeg FS (OUTPUT-time cues). */
  srtFile: string;
  /** Directory in the FFmpeg FS holding the caption font. */
  fontsDir: string;
  /** ASS force_style string (see buildForceStyle). */
  forceStyle: string;
}

export interface ExportOptions {
  /**
   * Whether the source has an audio stream. When false, the graph omits all
   * `[0:a]` references — required for silent clips, which otherwise abort with
   * "Stream specifier ':a' ... matches no streams". The renderer probes the
   * source and passes the right value.
   */
  withAudio?: boolean;
  /** When set, burn captions into the video via the `subtitles` filter. */
  captions?: CaptionBurn;
}

/**
 * Build the FFmpeg argv for exporting the current cut. Throws if nothing is
 * kept (caller should guard and tell the user).
 */
export function ffmpegArgsForExport(
  edl: EDL,
  { withAudio = true, captions }: ExportOptions = {},
): string[] {
  const kept = toKeptSegments(edl);
  if (kept.length === 0) {
    throw new Error("Nothing to export — every word has been removed.");
  }

  const { width: w, height: h } = TARGET_SIZES[edl.aspectRatio];

  const parts: string[] = [];
  const concatInputs: string[] = [];

  kept.forEach((s, i) => {
    parts.push(
      `[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS,` +
        `scale=${w}:${h}:force_original_aspect_ratio=increase,` +
        `crop=${w}:${h},setsar=1[v${i}]`,
    );
    if (withAudio) {
      parts.push(
        `[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS[a${i}]`,
      );
    }
    concatInputs.push(withAudio ? `[v${i}][a${i}]` : `[v${i}]`);
  });

  // Concatenate to [vcat]; if burning captions, run [vcat] through subtitles.
  const concat = withAudio
    ? `${concatInputs.join("")}concat=n=${kept.length}:v=1:a=1[vcat][outa]`
    : `${concatInputs.join("")}concat=n=${kept.length}:v=1:a=0[vcat]`;

  const chain = [...parts, concat];
  if (captions) {
    chain.push(
      `[vcat]subtitles=${captions.srtFile}:fontsdir=${captions.fontsDir}:` +
        `force_style='${captions.forceStyle}'[outv]`,
    );
  } else {
    // no caption pass → rename [vcat] to [outv] with a no-op copy
    chain.push(`[vcat]null[outv]`);
  }
  const filterComplex = chain.join(";");

  const args = [
    "-i",
    INPUT_NAME,
    "-filter_complex",
    filterComplex,
    "-map",
    "[outv]",
  ];
  if (withAudio) args.push("-map", "[outa]");
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p");
  if (withAudio) args.push("-c:a", "aac");
  else args.push("-an");
  args.push(OUTPUT_NAME);

  return args;
}

/**
 * Cost estimate for the cost meter (PLAN.md §4d). Browser rendering runs on the
 * user's machine, so compute is free — the meter still shows it for honesty and
 * to make the swap to a paid ServerRenderer visible later.
 */
export function estimateRenderCost(edl: EDL): CostEstimate {
  const secs = outputDuration(edl);
  return {
    usd: 0,
    breakdown: [`Browser render · ${secs.toFixed(1)}s output · $0.00`],
  };
}
