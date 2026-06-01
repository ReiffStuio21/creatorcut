"use client";

import { Loader2, Sparkles, RotateCw } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

/**
 * Center transcript panel (Phase 2). Generate a transcript, then click any word
 * to seek the preview to that moment. Phase 3 turns deleting words into cutting
 * the video (EDL).
 */
export function TranscriptPanel() {
  const video = useEditorStore((s) => s.video);
  const transcript = useEditorStore((s) => s.transcript);
  const step = useEditorStore((s) => s.transcribe);
  const runTranscribe = useEditorStore((s) => s.runTranscribe);
  const seekTo = useEditorStore((s) => s.seekTo);

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

      <div className="mt-3 flex-1 overflow-y-auto">
        {!video && (
          <p className="text-sm text-foreground/40">
            Upload a video first, then generate its transcript.
          </p>
        )}

        {video && step.status === "idle" && !transcript && (
          <button
            type="button"
            onClick={runTranscribe}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
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

        {transcript && step.status === "done" && (
          <p className="text-sm leading-7">
            {transcript.words.map((w, i) => (
              <button
                key={i}
                type="button"
                onClick={() => seekTo(w.start)}
                title={`Jump to ${w.start.toFixed(1)}s`}
                className={cn(
                  "rounded px-0.5 hover:bg-foreground/10",
                  w.kind === "filler" && "text-amber-600/80 italic",
                  w.kind === "silence" && "text-foreground/30",
                )}
              >
                {w.text}
              </button>
            ))}
          </p>
        )}
      </div>

      {transcript && step.status === "done" && (
        <p className="mt-3 border-t border-foreground/10 pt-3 text-xs text-foreground/40">
          Next: delete words to cut the video, and one-click clean up fillers (Phase 3).
        </p>
      )}
    </div>
  );
}
