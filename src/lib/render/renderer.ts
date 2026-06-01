/**
 * The Renderer seam. Preview and export never know which backend is running.
 * MVP ships WasmRenderer (FFmpeg.wasm, short clips). When the browser chokes on
 * longer clips, swap in ServerRenderer — same interface, no app rewrite.
 *
 * The architectural claim for the portfolio writeup: "I separated the edit
 * model from the rendering backends, so the same edit produces identical output
 * whether rendered in the browser or on a server."
 */

import type { CostEstimate, EDL, VideoSource } from "@/lib/edl/types";
import { outputDuration } from "@/lib/edl/operations";

export interface Renderer {
  /** Render the EDL against its source to a finished MP4 Blob. */
  render(edl: EDL, source: VideoSource): Promise<Blob>;
  /** Estimate cost for the cost meter (no work performed). */
  estimateCost(edl: EDL): CostEstimate;
}

// The browser-side renderer (FFmpeg.wasm) lives in ./wasm-renderer to keep the
// heavy FFmpeg import out of this module; it is dynamically imported on export.

/**
 * Server-side renderer (real ffmpeg worker). Phase 2 stub — the value right now
 * is the seam, so the editor is written against the interface from day one.
 */
export class ServerRenderer implements Renderer {
  async render(_edl: EDL, _source: VideoSource): Promise<Blob> {
    throw new Error(
      "ServerRenderer is a Phase 2 stub — see PLAN.md §11 (Roadmap).",
    );
  }

  estimateCost(edl: EDL): CostEstimate {
    const secs = outputDuration(edl);
    // Placeholder rate; tune when the worker is real.
    const usd = secs * 0.002;
    return {
      usd,
      breakdown: [`Server render (${secs.toFixed(1)}s @ $0.002/s): $${usd.toFixed(3)}`],
    };
  }
}
