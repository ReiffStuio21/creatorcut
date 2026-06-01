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
  INPUT_NAME,
  OUTPUT_NAME,
} from "./ffmpeg-args";

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

    try {
      await ffmpeg.writeFile(INPUT_NAME, await fetchFile(source.url));

      // Silent clips have no [0:a] stream; probe so the graph matches the source.
      const withAudio = await probeHasAudio(ffmpeg);
      const args = ffmpegArgsForExport(edl, { withAudio });

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
