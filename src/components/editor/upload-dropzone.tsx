"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store/editor";

// MVP accepts the common beginner formats; FFmpeg.wasm export comes in Phase 6.
const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_LABEL = "MP4, MOV, or WEBM";
// Hard cap protects the browser tab from memory blowups (PLAN.md §7, risk 5).
const MAX_FILE_MB = 500;

export function UploadDropzone() {
  const loadFile = useEditorStore((s) => s.loadFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError(`Unsupported file. Please upload ${ACCEPTED_LABEL}.`);
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That file is over ${MAX_FILE_MB} MB. Try a shorter clip for now.`);
      return;
    }
    loadFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
          dragging
            ? "border-foreground/40 bg-foreground/5"
            : "border-foreground/15 hover:border-foreground/30",
        )}
      >
        <Upload className="h-5 w-5 text-foreground/50" aria-hidden />
        <span className="text-sm font-medium">Drop a video here</span>
        <span className="text-xs text-foreground/50">
          or click to browse · {ACCEPTED_LABEL} · up to {MAX_FILE_MB} MB
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0])}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
