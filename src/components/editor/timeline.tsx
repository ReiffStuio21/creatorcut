"use client";

import { Scissors, Volume2, Undo2, Trash2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

/**
 * Timeline clip strip (CapCut-style editing): each segment is a block sized by
 * its length. Click to select + seek; split at the playhead to make a manual
 * cut anywhere; cut/restore the selected clip. Plus a master volume slider.
 */
export function Timeline() {
  const edl = useEditorStore((s) => s.edl);
  const done = useEditorStore((s) => s.transcribe.status === "done");
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedId = useEditorStore((s) => s.selectedSegmentId);
  const videoVolume = useEditorStore((s) => s.videoVolume);
  const select = useEditorStore((s) => s.selectSegment);
  const toggle = useEditorStore((s) => s.toggleSegment);
  const split = useEditorStore((s) => s.splitAtPlayhead);
  const seekTo = useEditorStore((s) => s.seekTo);
  const setVideoVolume = useEditorStore((s) => s.setVideoVolume);

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

        <label className="ml-auto flex items-center gap-2 text-[11px] text-foreground/50">
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
          <span className="w-8 text-right tabular-nums">
            {Math.round(videoVolume * 100)}%
          </span>
        </label>
      </div>

      <div className="mt-3 flex h-12 gap-[2px] overflow-hidden rounded-lg bg-black/30 p-1">
        {edl.segments.map((seg) => {
          const dur = Math.max(0.05, seg.end - seg.start);
          const playing = currentTime >= seg.start && currentTime < seg.end;
          const isSel = seg.id === selectedId;
          return (
            <button
              key={seg.id}
              type="button"
              title={seg.text || `${seg.start.toFixed(1)}–${seg.end.toFixed(1)}s`}
              onClick={() => {
                select(seg.id);
                seekTo(seg.start);
              }}
              style={{ flexGrow: dur, flexBasis: 0 }}
              className={cn(
                "relative min-w-[3px] rounded-[3px] transition-colors",
                seg.kept ? "accent-gradient opacity-90 hover:opacity-100" : "bg-foreground/10",
                isSel && "ring-2 ring-white",
                playing && !isSel && "ring-1 ring-accent-2",
              )}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-foreground/40">
        Click a clip to select · Split cuts at the playhead · faded clips are removed.
      </p>
    </div>
  );
}
