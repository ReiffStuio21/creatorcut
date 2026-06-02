/**
 * Server-side renderer (PLAN.md §4b). Sends the source video + EDL to the ffmpeg
 * worker and gets back a finished MP4 — for clips too long for the browser. Same
 * `Renderer` interface as WasmRenderer, so the editor doesn't know which backend
 * ran. Activated when NEXT_PUBLIC_RENDER_WORKER_URL is set.
 */

import type { CostEstimate, EDL, VideoSource } from "@/lib/edl/types";
import type { Renderer } from "./renderer";
import { outputDuration } from "@/lib/edl/operations";

export interface ServerRenderHooks {
  onStage?: (stage: "loading" | "encoding") => void;
}

export class ServerRenderer implements Renderer {
  constructor(
    private readonly workerUrl: string,
    private readonly hooks: ServerRenderHooks = {},
  ) {}

  async render(edl: EDL, source: VideoSource): Promise<Blob> {
    this.hooks.onStage?.("loading");
    const video = await (await fetch(source.url)).blob();

    const form = new FormData();
    form.append("edl", JSON.stringify(edl));
    form.append("video", video, source.id + ".mp4");

    this.hooks.onStage?.("encoding");
    const res = await fetch(`${this.workerUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Server render failed (${res.status}). ${detail.slice(0, 200)}`);
    }
    return res.blob();
  }

  estimateCost(edl: EDL): CostEstimate {
    const secs = outputDuration(edl);
    return {
      usd: 0,
      breakdown: [`Server render · ${secs.toFixed(1)}s output · worker compute`],
    };
  }
}
