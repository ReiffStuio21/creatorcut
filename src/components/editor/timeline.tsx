"use client";

import { useEffect, useRef, useState } from "react";
import { Scissors, Volume2, Undo2, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

/**
 * Timeline clip strip (CapCut-style): clips are laid out by source time. Drag
 * the playhead to scrub, drag a selected clip's edge handles to trim, split at
 * the playhead, and cut/restore clips. Plus master volume + denoise.
 */
export function Timeline() {
  const edl = useEditorStore((s) => s.edl);
  const done = useEditorStore((s) => s.transcribe.status === "done");
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedId = useEditorStore((s) => s.selectedSegmentId);
  const videoVolume = useEditorStore((s) => s.videoVolume);
  const videoDuration = useEditorStore((s) => s.video?.duration ?? 0);
  const select = useEditorStore((s) => s.selectSegment);
  const toggle = useEditorStore((s) => s.toggleSegment);
  const split = useEditorStore((s) => s.splitAtPlayhead);
  const scrub = useEditorStore((s) => s.scrub);
  const trimSelected = useEditorStore((s) => s.trimSelected);
  const setVideoVolume = useEditorStore((s) => s.setVideoVolume);
  const denoise = useEditorStore((s) => s.denoise);
  const setDenoise = useEditorStore((s) => s.setDenoise);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<null | "start" | "end" | "scrub">(null);
  const [zoom, setZoom] = useState(1);

  // time ↔ pixel mapping over the full source span
  const t0 = edl?.segments[0]?.start ?? 0;
  const lastEnd = edl?.segments.at(-1)?.end ?? 1;
  const span = Math.max(videoDuration, lastEnd) - t0 || 1;
  const pn = (t: number) => ((t - t0) / span) * 100;
  const timeAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return t0;
    return t0 + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * span;
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const t = timeAt(e.clientX);
      if (drag === "scrub") scrub(t);
      else {
        trimSelected(drag, t);
        scrub(t);
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // keep the playhead in view while scrubbing/playing when zoomed in
  useEffect(() => {
    const sc = scrollRef.current;
    const tr = trackRef.current;
    if (!sc || !tr || zoom <= 1) return;
    const x = (pn(currentTime) / 100) * tr.offsetWidth;
    if (x < sc.scrollLeft + 24 || x > sc.scrollLeft + sc.clientWidth - 24) {
      sc.scrollLeft = x - sc.clientWidth / 2;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, zoom]);

  if (!edl || !done) return null;
  const selected = edl.segments.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="rounded-xl border border-foreground/10 bg-panel/40 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={split}
          className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5"
        >
          <Scissors className="h-3.5 w-3.5" aria-hidden />
          Split
        </button>
        <button
          type="button"
          onClick={() => selected && toggle(selected.id)}
          disabled={!selected}
          className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-40"
        >
          {selected && !selected.kept ? (
            <>
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              Restore clip
            </>
          ) : (
            <>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Cut clip
            </>
          )}
        </button>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-foreground/15 p-0.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z / 2))}
            disabled={zoom <= 1}
            className="rounded p-1 hover:bg-foreground/10 disabled:opacity-40"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="w-6 text-center text-[11px] tabular-nums text-foreground/50">
            {zoom}×
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(16, z * 2))}
            disabled={zoom >= 16}
            className="rounded p-1 hover:bg-foreground/10 disabled:opacity-40"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setDenoise(!denoise)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
            denoise
              ? "border-transparent accent-gradient text-white"
              : "border-foreground/15 hover:bg-foreground/5",
          )}
        >
          Denoise
        </button>
        <label className="flex items-center gap-2 text-[11px] text-foreground/50">
          <Volume2 className="h-3.5 w-3.5" aria-hidden />
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={videoVolume}
            onChange={(e) => setVideoVolume(Number(e.target.value))}
            className="w-24 accent-[var(--accent)]"
            aria-label="Video volume"
          />
          <span className="w-8 text-right tabular-nums">{Math.round(videoVolume * 100)}%</span>
        </label>
      </div>

      {/* track (scrolls when zoomed in) */}
      <div ref={scrollRef} className="mt-3 overflow-x-auto rounded-lg bg-black/30">
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          // scrub unless a handle started the drag
          if (drag) return;
          setDrag("scrub");
          scrub(timeAt(e.clientX));
        }}
        style={{ width: `${zoom * 100}%` }}
        className="relative h-14 min-w-full cursor-pointer touch-none select-none"
      >
        {edl.segments.map((seg) => {
          const left = pn(seg.start);
          const width = Math.max(0.3, pn(seg.end) - pn(seg.start));
          const isSel = seg.id === selectedId;
          return (
            <button
              key={seg.id}
              type="button"
              title={seg.text || `${seg.start.toFixed(1)}–${seg.end.toFixed(1)}s`}
              onClick={(e) => {
                e.stopPropagation();
                select(seg.id);
              }}
              style={{ left: `${left}%`, width: `${width}%` }}
              className={cn(
                "absolute inset-y-1 rounded-[3px] transition-colors",
                seg.kept ? "accent-gradient opacity-90 hover:opacity-100" : "bg-foreground/10",
                isSel && "ring-2 ring-white",
              )}
            >
              {isSel && (
                <>
                  <span
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDrag("start");
                    }}
                    className="absolute inset-y-0 -left-1 w-2 cursor-ew-resize rounded-l bg-white/90"
                  />
                  <span
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDrag("end");
                    }}
                    className="absolute inset-y-0 -right-1 w-2 cursor-ew-resize rounded-r bg-white/90"
                  />
                </>
              )}
            </button>
          );
        })}

        {/* playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent-2"
          style={{ left: `${Math.min(100, Math.max(0, pn(currentTime)))}%` }}
        />
      </div>
      </div>
      <p className="mt-2 text-[11px] text-foreground/40">
        Drag the playhead to scrub · select a clip and drag edges to trim · zoom for precision.
      </p>
    </div>
  );
}
