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

/** A b-roll cutaway input: full-frame video shown during [start, start+duration]. */
export interface BrollInput {
  path: string;
  start: number;
  duration: number;
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
  /** B-roll cutaways shown full-frame over a window of output time. */
  broll?: BrollInput[];
  /** Output length in seconds — used to bound the music track. */
  outputSeconds?: number;
  /** FFmpeg color-filter chain applied to the base video (Phase 7). */
  videoFilter?: string;
  /** "fade" adds an intro/outro fade from/to black (video + audio). */
  transition?: "cut" | "fade";
  /** Master volume for the video's own audio (1 = unchanged). */
  videoVolume?: number;
}

const FADE_SECONDS = 0.4;

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
    broll = [],
    outputSeconds,
    videoFilter,
    transition = "cut",
    videoVolume = 1,
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
  const brollIndices = broll.map(() => nextIndex++);

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
  // B-roll cutaways: scale to fill, shift to its output start, show during the
  // window. Placed before captions/logo so those stay visible over the b-roll.
  broll.forEach((b, k) => {
    const idx = brollIndices[k];
    const end = (b.start + b.duration).toFixed(2);
    chain.push(
      `[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,` +
        `crop=${w}:${h},setsar=1,setpts=PTS+${b.start}/TB[bk${k}]`,
    );
    chain.push(`${v}[bk${k}]overlay=enable='between(t,${b.start},${end})'[bov${k}]`);
    v = `[bov${k}]`;
  });
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
  // Terminal: hard cut (null copy) or intro/outro fade from/to black.
  const fadeOutStart = Math.max(0, outSeconds - FADE_SECONDS).toFixed(2);
  const vEnd =
    transition === "fade"
      ? `fade=t=in:st=0:d=${FADE_SECONDS},fade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS}`
      : "null";
  chain.push(`${v}${vEnd}[outv]`);

  // Audio post-chain: master volume on the speech, then mix music under it.
  let speech = withAudio ? "[outa]" : null;
  if (speech && videoVolume !== 1) {
    chain.push(`${speech}volume=${videoVolume.toFixed(3)}[outav]`);
    speech = "[outav]";
  }
  if (music) {
    chain.push(
      `[${musicIndex}:a]volume=${music.volume},atrim=0:${outSeconds},` +
        `asetpts=PTS-STARTPTS[mus]`,
    );
  }
  let aout: string | null = null;
  if (speech && music) {
    chain.push(`${speech}[mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[amix]`);
    aout = "[amix]";
  } else if (speech) {
    aout = speech;
  } else if (music) {
    aout = "[mus]";
  }
  if (transition === "fade" && aout) {
    chain.push(
      `${aout}afade=t=in:st=0:d=${FADE_SECONDS},` +
        `afade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS}[aoutf]`,
    );
    aout = "[aoutf]";
  }

  const filterComplex = chain.join(";");

  // Inputs in index order: video, music, images.
  const args = ["-i", INPUT_NAME];
  if (music) args.push("-i", music.path);
  images.forEach((im) => args.push("-i", im.path));
  broll.forEach((b) => args.push("-i", b.path));

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
