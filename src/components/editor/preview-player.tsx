"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/store/editor";
import { skipToKept } from "@/lib/edl/operations";

/**
 * Center preview. Reads the EDL so playback skips removed segments (Phase 3):
 * on each timeupdate, if the playhead is inside a removed region it jumps to the
 * next kept moment (or pauses at the end of the cut).
 */
export function PreviewPlayer() {
  const video = useEditorStore((s) => s.video);
  const edl = useEditorStore((s) => s.edl);
  const setMetadata = useEditorStore((s) => s.setMetadata);
  const setVideoEl = useEditorStore((s) => s.setVideoEl);
  const localRef = useRef<HTMLVideoElement | null>(null);

  // Register the element in the store (for transcript shift-click seeking) and
  // keep a local ref for the skip effect.
  const ref = useCallback(
    (el: HTMLVideoElement | null) => {
      localRef.current = el;
      setVideoEl(el);
    },
    [setVideoEl],
  );

  useEffect(() => {
    const el = localRef.current;
    if (!el || !edl) return;
    const onTime = () => {
      const next = skipToKept(edl, el.currentTime);
      if (next === null) {
        el.pause();
        return;
      }
      // small epsilon so we don't fight normal playback inside a kept segment
      if (next > el.currentTime + 0.05) {
        el.currentTime = next;
      }
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
    <video
      key={video.id}
      ref={ref}
      src={video.url}
      controls
      playsInline
      className="aspect-video w-full rounded-xl bg-black"
      onLoadedMetadata={(e) => {
        const el = e.currentTarget;
        setMetadata({
          duration: el.duration,
          width: el.videoWidth,
          height: el.videoHeight,
        });
      }}
    />
  );
}
