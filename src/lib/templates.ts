/**
 * One-tap style templates: a cohesive set of aspect ratio + look + transition +
 * enhance/denoise + caption style applied to the current project in one click.
 */
import type {
  AspectRatio,
  CaptionStyle,
  TransitionId,
  VideoFilterId,
} from "@/lib/edl/types";

export interface Template {
  id: string;
  name: string;
  emoji: string;
  aspectRatio: AspectRatio;
  filter: VideoFilterId;
  transition: TransitionId;
  enhance: boolean;
  denoise: boolean;
  captionStyle: CaptionStyle;
  captionColor: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "talking",
    name: "Talking head",
    emoji: "🎙️",
    aspectRatio: "9:16",
    filter: "none",
    transition: "cut",
    enhance: true,
    denoise: true,
    captionStyle: "clean-bottom",
    captionColor: "#FFFFFF",
  },
  {
    id: "social",
    name: "Bold social",
    emoji: "🔥",
    aspectRatio: "9:16",
    filter: "vivid",
    transition: "fade",
    enhance: true,
    denoise: false,
    captionStyle: "bold-bottom",
    captionColor: "#FACC15",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    emoji: "🎬",
    aspectRatio: "16:9",
    filter: "cool",
    transition: "fade",
    enhance: false,
    denoise: true,
    captionStyle: "boxed-center",
    captionColor: "#FFFFFF",
  },
  {
    id: "vlog",
    name: "Warm vlog",
    emoji: "☀️",
    aspectRatio: "9:16",
    filter: "warm",
    transition: "cut",
    enhance: true,
    denoise: false,
    captionStyle: "bold-bottom",
    captionColor: "#FFFFFF",
  },
  {
    id: "tutorial",
    name: "Tutorial",
    emoji: "📚",
    aspectRatio: "16:9",
    filter: "none",
    transition: "cut",
    enhance: false,
    denoise: true,
    captionStyle: "clean-bottom",
    captionColor: "#FFFFFF",
  },
  {
    id: "promo",
    name: "Promo",
    emoji: "✨",
    aspectRatio: "1:1",
    filter: "bright",
    transition: "fade",
    enhance: true,
    denoise: false,
    captionStyle: "boxed-center",
    captionColor: "#FFFFFF",
  },
];
