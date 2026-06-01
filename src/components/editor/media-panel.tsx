"use client";

import { Film, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { formatBytes, formatDuration } from "@/lib/utils";
import { UploadDropzone } from "./upload-dropzone";

/**
 * Left rail — media. Phase 1 handles the source video (upload + summary).
 * Music / images / b-roll tracks arrive in Phase 5.
 */
export function MediaPanel() {
  const video = useEditorStore((s) => s.video);
  const reset = useEditorStore((s) => s.reset);

  if (!video) {
    return <UploadDropzone />;
  }

  const resolution = video.width ? `${video.width}×${video.height}` : "—";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-xl border border-foreground/10 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
          <Film className="h-4 w-4 text-foreground/60" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={video.fileName}>
            {video.fileName}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50">
            {formatDuration(video.duration)} · {resolution} ·{" "}
            {formatBytes(video.fileSize)}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md p-1 text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
          aria-label="Remove video"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p className="px-1 text-xs text-foreground/40">
        Next: generate a transcript to start editing (Phase 2).
      </p>
    </div>
  );
}
