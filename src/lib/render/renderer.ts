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

/**
 * Browser-side renderer (FFmpeg.wasm). Stubbed until Phase 6, when the
 * @ffmpeg/ffmpeg deps are added and the EDL → filtergraph translation lands.
 */
export class WasmRenderer implements Renderer {
  async render(_edl: EDL, _source: VideoSource): Promise<Blob> {
    throw new Error(
      "WasmRenderer not implemented yet — see PLAN.md Phase 6 (Export).",
    );
  }

  estimateCost(edl: EDL): CostEstimate {
    // Browser rendering runs on the user's machine → $0 compute.
    const secs = outputDuration(edl);
    return {
      usd: 0,
      breakdown: [`Browser render (${secs.toFixed(1)}s output): $0.00`],
    };
  }
}

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
