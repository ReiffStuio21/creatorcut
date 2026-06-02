"use client";

import { Loader2, Sparkles, RotateCw, Wand2, Undo2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { outputDuration, toKeptSegments } from "@/lib/edl/operations";
import { cn, formatDuration } from "@/lib/utils";

/**
 * The heart of the app (Phase 3): editing the transcript edits the video.
 * Click a word to remove it (the cut updates instantly); click again to restore.
 * Shift-click seeks the preview to that word. "Clean up" drops fillers + silence.
 */
export function TranscriptPanel() {
  const video = useEditorStore((s) => s.video);
  const transcript = useEditorStore((s) => s.transcript);
  const edl = useEditorStore((s) => s.edl);
  const step = useEditorStore((s) => s.transcribe);
  const runTranscribe = useEditorStore((s) => s.runTranscribe);
  const toggleSegment = useEditorStore((s) => s.toggleSegment);
  const cleanup = useEditorStore((s) => s.cleanup);
  const restoreAll = useEditorStore((s) => s.restoreAll);
  const seekTo = useEditorStore((s) => s.seekTo);

  const editing = edl && step.status === "done";
  const keptCount = edl ? toKeptSegments(edl).length : 0;
  const totalCount = edl ? edl.segments.length : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          Transcript
        </h2>
        {transcript?.mock && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
            Demo transcript
          </span>
        )}
      </div>

      {/* Editing toolbar */}
      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-foreground/10 pb-3 text-xs">
          <button
            type="button"
            onClick={cleanup}
            className="inline-flex items-center gap-1.5 rounded-full accent-gradient px-3 py-1.5 font-medium text-white"
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Clean up
          </button>
          <button
            type="button"
            onClick={restoreAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 font-medium hover:bg-foreground/5"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            Restore all
          </button>
          <span className="ml-auto text-foreground/50">
            Output {formatDuration(outputDuration(edl))} · {keptCount}/{totalCount} words
          </span>
        </div>
      )}

      <div className="mt-3 flex-1 overflow-y-auto">
        {!video && (
          <p className="text-sm text-foreground/40">
            Upload a video first, then generate its transcript.
          </p>
        )}

        {video && step.status === "idle" && !edl && (
          <button
            type="button"
            onClick={runTranscribe}
            className="inline-flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white glow-accent"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Generate transcript
          </button>
        )}

        {step.status === "running" && (
          <p className="inline-flex items-center gap-2 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Transcribing…
          </p>
        )}

        {step.status === "error" && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-red-500">
              {step.error ?? "Transcription failed."}
            </p>
            <button
              type="button"
              onClick={runTranscribe}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
            >
              <RotateCw className="h-4 w-4" aria-hidden />
              Retry
            </button>
          </div>
        )}

        {editing && (
          <p className="text-sm leading-8">
            {edl.segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={(e) => {
                  if (e.shiftKey) seekTo(seg.start);
                  else toggleSegment(seg.id);
                }}
                title={
                  seg.kept
                    ? "Click to remove · Shift-click to play from here"
                    : "Click to restore"
                }
                className={cn(
                  "rounded px-0.5 transition-colors",
                  seg.kept
                    ? "hover:bg-red-500/10"
                    : "text-foreground/30 line-through decoration-foreground/40",
                  seg.kept && seg.reason === "filler" && "text-amber-600/80 italic",
                  seg.kept && seg.reason === "silence" && "text-foreground/30",
                )}
              >
                {seg.text}
              </button>
            ))}
          </p>
        )}
      </div>

      {editing && (
        <p className="mt-3 border-t border-foreground/10 pt-3 text-xs text-foreground/40">
          Click a word to cut it from the video. Removed words are struck through.
        </p>
      )}
    </div>
  );
}
