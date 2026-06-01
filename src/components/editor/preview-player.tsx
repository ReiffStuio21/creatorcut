"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store/editor";
import { skipToKept } from "@/lib/edl/operations";
import { activeCue, buildCaptionCues } from "@/lib/captions/cues";
import type { CaptionStyle } from "@/lib/edl/types";
import { cn } from "@/lib/utils";

const STYLE_CLASSES: Record<CaptionStyle, string> = {
  "bold-bottom": "text-xl font-extrabold uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",
  "clean-bottom": "text-lg font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]",
  "boxed-center": "text-lg font-semibold rounded-md bg-black/70 px-3 py-1",
};

/**
 * Center preview. Reads the EDL so playback skips removed segments (Phase 3) and
 * renders synced captions over the video (Phase 4).
 */
export function PreviewPlayer() {
  const video = useEditorStore((s) => s.video);
  const edl = useEditorStore((s) => s.edl);
  const setMetadata = useEditorStore((s) => s.setMetadata);
  const setVideoEl = useEditorStore((s) => s.setVideoEl);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const ref = useCallback(
    (el: HTMLVideoElement | null) => {
      localRef.current = el;
      setVideoEl(el);
    },
    [setVideoEl],
  );

  const cues = useMemo(() => (edl ? buildCaptionCues(edl) : []), [edl]);
  const captions = edl?.captions;
  const cue =
    captions?.enabled && cues.length ? activeCue(cues, currentTime) : null;

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const onTime = () => {
      if (edl) {
        const next = skipToKept(edl, el.currentTime);
        if (next === null) {
          el.pause();
        } else if (next > el.currentTime + 0.05) {
          el.currentTime = next;
        }
      }
      setCurrentTime(el.currentTime);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [edl, video?.id]);

  if (!video) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-foreground/15 text-sm text-foreground/40">
        Upload a video to preview it here
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <video
        key={video.id}
        ref={ref}
        src={video.url}
        controls
        playsInline
        className="h-full w-full"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setMetadata({
            duration: el.duration,
            width: el.videoWidth,
            height: el.videoHeight,
          });
        }}
      />
      {cue && captions && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-6 text-center">
          <span
            className={cn("max-w-[90%]", STYLE_CLASSES[captions.style])}
            style={{ color: captions.color }}
          >
            {cue.text}
          </span>
        </div>
      )}
    </div>
  );
}
