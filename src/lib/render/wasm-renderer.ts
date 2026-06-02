/**
 * Browser-side renderer (FFmpeg.wasm) — the MVP export path (PLAN.md §4b).
 * Translates the EDL into an FFmpeg run that cuts the kept segments, concatenates
 * them, and applies the aspect ratio, returning a downloadable MP4 Blob.
 */

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type { CostEstimate, EDL, VideoSource } from "@/lib/edl/types";
import type { Renderer } from "./renderer";
import { getFFmpeg } from "./ffmpeg";
import {
  estimateRenderCost,
  ffmpegArgsForExport,
  type CaptionBurn,
  INPUT_NAME,
  OUTPUT_NAME,
} from "./ffmpeg-args";
import { buildForceStyle, buildOutputCues, toSrt } from "@/lib/captions/srt";
import { getFilter } from "@/lib/filters";

// A real TTF (family "Roboto") for libass to burn captions; fetched once.
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@expo-google-fonts/roboto/Roboto_400Regular.ttf";
const FONTS_DIR = "fonts";
const FONT_PATH = `${FONTS_DIR}/Roboto_400Regular.ttf`;
const SRT_PATH = "subs.srt";
const MUSIC_PATH = "music_in";

export interface WasmRenderHooks {
  /** "loading" = fetching/booting the FFmpeg core; "encoding" = running it. */
  onStage?: (stage: "loading" | "encoding") => void;
  /** encode progress, 0..1 */
  onProgress?: (value: number) => void;
}

export class WasmRenderer implements Renderer {
  constructor(private readonly hooks: WasmRenderHooks = {}) {}

  async render(edl: EDL, source: VideoSource): Promise<Blob> {
    // Fail fast on an empty cut before loading the core.
    if (ffmpegArgsForExport(edl).length === 0) throw new Error("empty export");

    this.hooks.onStage?.("loading");
    const ffmpeg = await getFFmpeg();

    const onProgress = ({ progress }: { progress: number }) => {
      this.hooks.onProgress?.(Math.min(1, Math.max(0, progress)));
    };
    ffmpeg.on("progress", onProgress);

    const imagePaths: string[] = [];
    const brollPaths: string[] = [];
    try {
      await ffmpeg.writeFile(INPUT_NAME, await fetchFile(source.url));

      // Silent clips have no [0:a] stream; probe so the graph matches the source.
      const withAudio = await probeHasAudio(ffmpeg);

      // Burn captions into the file when enabled and there are cues to show.
      let captions: CaptionBurn | undefined;
      const outCues = edl.captions.enabled ? buildOutputCues(edl) : [];
      if (outCues.length > 0) {
        await ffmpeg.createDir(FONTS_DIR).catch(() => {});
        await ffmpeg.writeFile(FONT_PATH, await fetchFile(FONT_URL));
        await ffmpeg.writeFile(SRT_PATH, new TextEncoder().encode(toSrt(outCues)));
        captions = {
          srtFile: SRT_PATH,
          fontsDir: FONTS_DIR,
          forceStyle: buildForceStyle(edl.captions),
        };
      }

      // Write user media (Phase 5) and pass it to the graph.
      const musicTrack = edl.tracks.music[0];
      let music: { path: string; volume: number } | undefined;
      if (musicTrack) {
        await ffmpeg.writeFile(MUSIC_PATH, await fetchFile(musicTrack.src));
        music = { path: MUSIC_PATH, volume: musicTrack.volume };
      }
      const images = await Promise.all(
        edl.tracks.images.map(async (im, k) => {
          const path = `img_in_${k}`;
          await ffmpeg.writeFile(path, await fetchFile(im.src));
          imagePaths.push(path);
          return { path, x: im.x, y: im.y };
        }),
      );

      const broll = await Promise.all(
        (edl.tracks.broll ?? []).map(async (b, k) => {
          const path = `broll_in_${k}`;
          await ffmpeg.writeFile(path, await fetchFile(b.src));
          brollPaths.push(path);
          return { path, start: b.start, duration: b.duration };
        }),
      );

      const videoFilter = getFilter(edl.filter).ffmpeg || undefined;
      const args = ffmpegArgsForExport(edl, {
        withAudio,
        captions,
        music,
        images,
        broll,
        videoFilter,
        transition: edl.transition,
        videoVolume: edl.volume ?? 1,
        enhance: edl.enhance ?? false,
        denoise: edl.denoise ?? false,
      });

      this.hooks.onStage?.("encoding");
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(OUTPUT_NAME).catch(() => {
        throw new Error("FFmpeg produced no output — the encode failed.");
      });
      const bytes =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
      if (bytes.length === 0) throw new Error("FFmpeg produced an empty file.");
      return new Blob([bytes as BlobPart], { type: "video/mp4" });
    } finally {
      ffmpeg.off("progress", onProgress);
      await ffmpeg.deleteFile(INPUT_NAME).catch(() => {});
      await ffmpeg.deleteFile(OUTPUT_NAME).catch(() => {});
      await ffmpeg.deleteFile(SRT_PATH).catch(() => {});
      await ffmpeg.deleteFile(MUSIC_PATH).catch(() => {});
      await Promise.all(imagePaths.map((p) => ffmpeg.deleteFile(p).catch(() => {})));
      await Promise.all(brollPaths.map((p) => ffmpeg.deleteFile(p).catch(() => {})));
    }
  }

  estimateCost(edl: EDL): CostEstimate {
    return estimateRenderCost(edl);
  }
}

/**
 * Probe the written INPUT for an audio stream by running a no-output `-i` pass
 * (which exits non-zero without aborting) and scanning the FFmpeg log. Returns
 * false on any doubt so a silent clip still exports.
 */
async function probeHasAudio(ffmpeg: FFmpeg): Promise<boolean> {
  let log = "";
  const onLog = ({ message }: { message: string }) => {
    log += message + "\n";
  };
  ffmpeg.on("log", onLog);
  try {
    await ffmpeg.exec(["-hide_banner", "-i", INPUT_NAME]);
  } catch {
    // expected: no output file specified → non-zero exit
  } finally {
    ffmpeg.off("log", onLog);
  }
  return /Stream #\d+:\d+.*: Audio:/.test(log);
}
