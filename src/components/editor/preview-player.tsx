"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store/editor";
import { outputDuration, skipToKept, sourceToOutputTime } from "@/lib/edl/operations";
import { activeCue, buildCaptionCues } from "@/lib/captions/cues";
import type { CaptionStyle } from "@/lib/edl/types";
import { getFilter } from "@/lib/filters";
import { cn } from "@/lib/utils";

const STYLE_CLASSES: Record<CaptionStyle, string> = {
  "bold-bottom": "text-xl font-extrabold uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",
  "clean-bottom": "text-lg font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]",
  "boxed-center": "text-lg font-semibold rounded-md bg-black/70 px-3 py-1",
};

/**
 * Center preview. Reads the EDL so playback skips removed segments (Phase 3),
 * renders synced captions (Phase 4), and shows image overlays + plays the
 * background music in rough sync with the cut (Phase 5).
 */
export function PreviewPlayer() {
  const video = useEditorStore((s) => s.video);
  const edl = useEditorStore((s) => s.edl);
  const music = useEditorStore((s) => s.music);
  const images = useEditorStore((s) => s.images);
  const filter = useEditorStore((s) => s.filter);
  const transition = useEditorStore((s) => s.transition);
  const setMetadata = useEditorStore((s) => s.setMetadata);
  const setVideoEl = useEditorStore((s) => s.setVideoEl);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // intro/outro fade overlay opacity (matches the export's fade transition)
  let fadeOpacity = 0;
  if (transition === "fade" && edl) {
    const FD = 0.4;
    const outDur = outputDuration(edl);
    const outT = sourceToOutputTime(edl, currentTime);
    const inRamp = Math.max(0, (FD - outT) / FD);
    const outRamp = Math.max(0, (outT - (outDur - FD)) / FD);
    fadeOpacity = Math.min(1, Math.max(inRamp, outRamp));
  }

  // Keep the music element's volume in sync with the track setting.
  useEffect(() => {
    if (audioRef.current && music) audioRef.current.volume = music.volume;
  }, [music]);

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
        // keep the music aligned to the OUTPUT (post-cut) timeline
        const audio = audioRef.current;
        if (audio && music) {
          const outT = sourceToOutputTime(edl, el.currentTime);
          if (Math.abs(audio.currentTime - outT) > 0.3) audio.currentTime = outT;
        }
      }
      setCurrentTime(el.currentTime);
    };
    const onPlay = () => audioRef.current?.play().catch(() => {});
    const onPause = () => audioRef.current?.pause();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [edl, music, video?.id]);

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
        style={{ filter: getFilter(filter).css || undefined }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setMetadata({
            duration: el.duration,
            width: el.videoWidth,
            height: el.videoHeight,
          });
        }}
      />

      {/* image/logo overlays (approximate — export is authoritative) */}
      {images.map((im) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={im.id}
          src={im.url}
          alt=""
          className="pointer-events-none absolute w-1/4"
          style={{ left: `${im.x * 0.75}%`, top: `${im.y * 0.75}%` }}
        />
      ))}

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

      {fadeOpacity > 0 && (
        <div
          className="pointer-events-none absolute inset-0 bg-black"
          style={{ opacity: fadeOpacity }}
        />
      )}

      {music && <audio ref={audioRef} src={music.url} preload="auto" />}
    </div>
  );
}
