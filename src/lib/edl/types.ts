/**
 * The Edit Decision List (EDL) — CreatorCut's single source of truth.
 *
 * The preview player and every Renderer backend read the SAME EDL, so an edit
 * produces identical output whether rendered in the browser or on a server.
 * The EDL is plain data; all operations on it are pure functions (see
 * `operations.ts`) and therefore trivially unit-testable.
 */

export type AspectRatio = "9:16" | "1:1" | "16:9";

export type SegmentReason = "filler" | "silence" | "user";

/**
 * One transcript-aligned slice of the source video. Deleting a segment in the
 * UI flips `kept` to false; the preview and renderer skip un-kept segments.
 */
export interface Segment {
  id: string;
  /** Start time in the SOURCE video, seconds. */
  start: number;
  /** End time in the SOURCE video, seconds. */
  end: number;
  /** Whether this segment is included in the final cut. */
  kept: boolean;
  /** Transcript text for this segment. */
  text: string;
  /** Why a segment was auto-marked (filler/silence) — undefined for normal speech. */
  reason?: SegmentReason;
}

export type CaptionStyle = "bold-bottom" | "clean-bottom" | "boxed-center";

export interface CaptionConfig {
  enabled: boolean;
  style: CaptionStyle;
  color: string;
}

export interface MusicTrack {
  src: string;
  /** Where the track starts in the OUTPUT timeline, seconds. */
  start: number;
  /** 0..1 */
  volume: number;
}

export interface ImageOverlay {
  src: string;
  /** Output-timeline window, seconds. */
  start: number;
  end: number;
  /** Position as percentage of frame, 0..100. */
  x: number;
  y: number;
}

export interface EDLTracks {
  music: MusicTrack[];
  images: ImageOverlay[];
}

/** Color "look" applied to the whole video (Phase 7). */
export type VideoFilterId = "none" | "warm" | "cool" | "mono" | "vivid" | "bright";

/** Intro/outro transition. "cut" = hard cut; "fade" = fade from/to black. */
export type TransitionId = "cut" | "fade";

export interface EDL {
  /** Source asset id. */
  source: string;
  aspectRatio: AspectRatio;
  segments: Segment[];
  captions: CaptionConfig;
  tracks: EDLTracks;
  /** Color look; defaults to "none". */
  filter: VideoFilterId;
  /** Intro/outro transition; defaults to "cut". */
  transition: TransitionId;
}

/** A video source the renderer can read (file in browser memory, or a URL). */
export interface VideoSource {
  id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
}

export interface CostEstimate {
  /** Estimated USD cost for the operation. */
  usd: number;
  /** Human-readable breakdown lines for the cost meter. */
  breakdown: string[];
}

/** A sensible empty EDL for a freshly-uploaded source. */
export function emptyEDL(source: string, aspectRatio: AspectRatio = "9:16"): EDL {
  return {
    source,
    aspectRatio,
    segments: [],
    captions: { enabled: true, style: "bold-bottom", color: "#FFFFFF" },
    tracks: { music: [], images: [] },
    filter: "none",
    transition: "cut",
  };
}
