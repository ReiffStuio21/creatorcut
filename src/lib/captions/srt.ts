/**
 * Turn the EDL's caption cues into a burn-ready SRT (in OUTPUT time, since the
 * exported file is the post-cut concatenation) plus an ASS `force_style` string
 * for the FFmpeg `subtitles` filter. Pure → unit-testable.
 */

import type { CaptionConfig } from "@/lib/edl/types";
import type { EDL } from "@/lib/edl/types";
import { sourceToOutputTime } from "@/lib/edl/operations";
import { buildCaptionCues, type CaptionCue } from "./cues";

/** Font shipped into the FFmpeg FS for libass (family name must match the TTF). */
export const CAPTION_FONT_FAMILY = "Roboto";

/** Source-time cues remapped onto the output timeline. */
export function buildOutputCues(edl: EDL): CaptionCue[] {
  return buildCaptionCues(edl).map((c) => ({
    start: sourceToOutputTime(edl, c.start),
    end: sourceToOutputTime(edl, c.end),
    text: c.text,
  }));
}

function srtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(milli, 3)}`;
}

export function toSrt(cues: CaptionCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}

/** #RRGGBB → ASS &HAABBGGRR (alpha 00 = opaque). */
export function hexToAssColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const rgb = m ? m[1] : "FFFFFF";
  const r = rgb.slice(0, 2);
  const g = rgb.slice(2, 4);
  const b = rgb.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/** ASS force_style for the `subtitles` filter, derived from the caption config. */
export function buildForceStyle(captions: CaptionConfig): string {
  const primary = hexToAssColor(captions.color);
  const base = [
    `FontName=${CAPTION_FONT_FAMILY}`,
    `PrimaryColour=${primary}`,
    "Alignment=2",
    "MarginV=48",
  ];
  if (captions.style === "boxed-center") {
    base.push("FontSize=18", "BorderStyle=3", "BackColour=&H80000000", "Outline=0", "Shadow=0");
  } else if (captions.style === "clean-bottom") {
    base.push("FontSize=16", "Bold=0", "Outline=1", "Shadow=1");
  } else {
    // bold-bottom (default)
    base.push("FontSize=20", "Bold=-1", "Outline=2", "Shadow=1");
  }
  return base.join(",");
}
