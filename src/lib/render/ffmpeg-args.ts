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

/** A background music input (Phase 5). */
export interface MusicInput {
  path: string;
  volume: number;
}

/** An image/logo overlay input (Phase 5). x/y are % of the frame, 0..100. */
export interface ImageInput {
  path: string;
  x: number;
  y: number;
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
  /** Background music mixed under the speech (Phase 5). */
  music?: MusicInput;
  /** Image/logo overlays, drawn in order (Phase 5). */
  images?: ImageInput[];
  /** Output length in seconds — used to bound the music track. */
  outputSeconds?: number;
  /** FFmpeg color-filter chain applied to the base video (Phase 7). */
  videoFilter?: string;
}

/**
 * Build the FFmpeg argv for exporting the current cut. Throws if nothing is
 * kept (caller should guard and tell the user).
 */
export function ffmpegArgsForExport(
  edl: EDL,
  {
    withAudio = true,
    captions,
    music,
    images = [],
    outputSeconds,
    videoFilter,
  }: ExportOptions = {},
): string[] {
  const kept = toKeptSegments(edl);
  if (kept.length === 0) {
    throw new Error("Nothing to export — every word has been removed.");
  }

  const { width: w, height: h } = TARGET_SIZES[edl.aspectRatio];
  const outSeconds = outputSeconds ?? outputDuration(edl);

  // Input indices: 0 = video, then music (if any), then each image.
  let nextIndex = 1;
  const musicIndex = music ? nextIndex++ : -1;
  const imageIndices = images.map(() => nextIndex++);

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

  const concat = withAudio
    ? `${concatInputs.join("")}concat=n=${kept.length}:v=1:a=1[vcat][outa]`
    : `${concatInputs.join("")}concat=n=${kept.length}:v=1:a=0[vcat]`;

  const chain = [...parts, concat];

  // Video post-chain: color filter → captions burn → image overlays → [outv].
  let v = "[vcat]";
  if (videoFilter) {
    chain.push(`${v}${videoFilter}[vf]`);
    v = "[vf]";
  }
  if (captions) {
    chain.push(
      `${v}subtitles=${captions.srtFile}:fontsdir=${captions.fontsDir}:` +
        `force_style='${captions.forceStyle}'[vcap]`,
    );
    v = "[vcap]";
  }
  images.forEach((im, k) => {
    const idx = imageIndices[k];
    // Scale logo to a quarter of the frame width, then overlay at x/y %.
    chain.push(`[${idx}:v]scale=${Math.round(w * 0.25)}:-1[img${k}]`);
    chain.push(
      `${v}[img${k}]overlay=x=(W-w)*${(im.x / 100).toFixed(4)}:` +
        `y=(H-h)*${(im.y / 100).toFixed(4)}[ov${k}]`,
    );
    v = `[ov${k}]`;
  });
  chain.push(`${v}null[outv]`);

  // Audio post-chain: mix music under the speech (or use whichever exists).
  let aout: string | null = null;
  if (music) {
    chain.push(
      `[${musicIndex}:a]volume=${music.volume},atrim=0:${outSeconds},` +
        `asetpts=PTS-STARTPTS[mus]`,
    );
  }
  if (withAudio && music) {
    chain.push(`[outa][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`);
    aout = "[aout]";
  } else if (withAudio) {
    aout = "[outa]";
  } else if (music) {
    aout = "[mus]";
  }

  const filterComplex = chain.join(";");

  // Inputs in index order: video, music, images.
  const args = ["-i", INPUT_NAME];
  if (music) args.push("-i", music.path);
  images.forEach((im) => args.push("-i", im.path));

  args.push("-filter_complex", filterComplex, "-map", "[outv]");
  if (aout) args.push("-map", aout);
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p");
  if (aout) args.push("-c:a", "aac");
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
