/**
 * Browser-side renderer (FFmpeg.wasm) — the MVP export path (PLAN.md §4b).
 * Translates the EDL into an FFmpeg run that cuts the kept segments, concatenates
 * them, and applies the aspect ratio, returning a downloadable MP4 Blob.
 */

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
    // Build args first so an empty cut fails fast, before loading the core.
    const args = ffmpegArgsForExport(edl);

    this.hooks.onStage?.("loading");
    const ffmpeg = await getFFmpeg();

    const onProgress = ({ progress }: { progress: number }) => {
      this.hooks.onProgress?.(Math.min(1, Math.max(0, progress)));
    };
    ffmpeg.on("progress", onProgress);

    try {
      await ffmpeg.writeFile(INPUT_NAME, await fetchFile(source.url));
      this.hooks.onStage?.("encoding");
      await ffmpeg.exec(args);
      const data = await ffmpeg.readFile(OUTPUT_NAME);
      const bytes =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
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
