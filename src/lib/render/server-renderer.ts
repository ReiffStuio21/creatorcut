/**
 * Server-side renderer (PLAN.md §4b). Sends the source video + EDL to the ffmpeg
 * worker and gets back a finished MP4 — for clips too long for the browser. Same
 * `Renderer` interface as WasmRenderer, so the editor doesn't know which backend
 * ran. Activated when NEXT_PUBLIC_RENDER_WORKER_URL is set.
 */

import type { CostEstimate, EDL, VideoSource } from "@/lib/edl/types";
import type { Renderer } from "./renderer";
import { outputDuration } from "@/lib/edl/operations";

const blobFromUrl = async (url: string): Promise<Blob> => (await fetch(url)).blob();

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
    const form = new FormData();
    form.append("video", await blobFromUrl(source.url), source.id + ".mp4");

    // Upload each media file under a key, and replace its object-URL `src` with
    // that key so the worker can map the EDL's tracks to the uploaded files.
    const e: EDL = {
      ...edl,
      tracks: {
        music: edl.tracks.music.map((m) => ({ ...m })),
        images: edl.tracks.images.map((im) => ({ ...im })),
        broll: edl.tracks.broll.map((b) => ({ ...b })),
        voiceover: edl.tracks.voiceover ? { ...edl.tracks.voiceover } : undefined,
      },
    };
    for (const [i, m] of e.tracks.music.entries()) {
      const key = `m_music_${i}`;
      form.append(key, await blobFromUrl(m.src), key);
      m.src = key;
    }
    for (const [i, im] of e.tracks.images.entries()) {
      const key = `m_image_${i}`;
      form.append(key, await blobFromUrl(im.src), key);
      im.src = key;
    }
    for (const [i, b] of e.tracks.broll.entries()) {
      const key = `m_broll_${i}`;
      form.append(key, await blobFromUrl(b.src), key);
      b.src = key;
    }
    if (e.tracks.voiceover) {
      const key = "m_voiceover";
      form.append(key, await blobFromUrl(e.tracks.voiceover.src), key);
      e.tracks.voiceover.src = key;
    }
    form.append("edl", JSON.stringify(e));

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
