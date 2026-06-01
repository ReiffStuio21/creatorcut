/**
 * Color "looks" (Phase 7). Each filter has a CSS approximation for the preview
 * and an FFmpeg filter string for the export, so the two stay close.
 */

import type { VideoFilterId } from "@/lib/edl/types";

export interface VideoFilter {
  id: VideoFilterId;
  label: string;
  /** CSS `filter` value for the preview (empty = none). */
  css: string;
  /** FFmpeg video filter chain for export (empty = none). */
  ffmpeg: string;
}

export const FILTERS: VideoFilter[] = [
  { id: "none", label: "None", css: "", ffmpeg: "" },
  {
    id: "warm",
    label: "Warm",
    css: "saturate(1.1) sepia(0.18)",
    ffmpeg: "colorbalance=rs=0.10:gs=0.02:bs=-0.10,eq=saturation=1.1",
  },
  {
    id: "cool",
    label: "Cool",
    css: "saturate(1.1) hue-rotate(-12deg)",
    ffmpeg: "colorbalance=rs=-0.10:bs=0.10,eq=saturation=1.05",
  },
  { id: "mono", label: "Mono", css: "grayscale(1)", ffmpeg: "hue=s=0" },
  {
    id: "vivid",
    label: "Vivid",
    css: "saturate(1.5) contrast(1.1)",
    ffmpeg: "eq=saturation=1.5:contrast=1.1",
  },
  {
    id: "bright",
    label: "Bright",
    css: "brightness(1.08) contrast(1.05)",
    ffmpeg: "eq=brightness=0.08:contrast=1.05",
  },
];

const BY_ID = new Map(FILTERS.map((f) => [f.id, f]));

export function getFilter(id: VideoFilterId | undefined): VideoFilter {
  return BY_ID.get(id ?? "none") ?? FILTERS[0];
}
