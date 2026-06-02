"use client";

import { Download, Loader2, RotateCw } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { estimateRenderCost } from "@/lib/render/ffmpeg-args";
import type { AspectRatio } from "@/lib/edl/types";
import { cn } from "@/lib/utils";

const RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
];

export function ExportPanel() {
  const edl = useEditorStore((s) => s.edl);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);
  const runExport = useEditorStore((s) => s.runExport);
  const serverRender = useEditorStore((s) => s.serverRender);
  const setServerRender = useEditorStore((s) => s.setServerRender);
  const workerConfigured = Boolean(process.env.NEXT_PUBLIC_RENDER_WORKER_URL);
  const step = useEditorStore((s) => s.exportStep);
  const stage = useEditorStore((s) => s.exportStage);
  const progress = useEditorStore((s) => s.exportProgress);
  const exportUrl = useEditorStore((s) => s.exportUrl);

  if (!edl) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
        Generate a transcript and make your cut, then export an MP4.
      </div>
    );
  }

  const running = step.status === "running";
  const cost = estimateRenderCost(edl);

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-foreground/50">Aspect ratio</span>
        <div className="flex gap-1.5">
          {RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={running}
              onClick={() => setAspectRatio(r.value)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                aspectRatio === r.value
                  ? "border-transparent accent-gradient text-white"
                  : "border-foreground/15 hover:bg-foreground/5",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {workerConfigured && (
        <label className="flex items-center gap-2 text-xs text-foreground/60">
          <input
            type="checkbox"
            checked={serverRender}
            onChange={(e) => setServerRender(e.target.checked)}
            disabled={running}
            className="h-3.5 w-3.5 accent-foreground"
          />
          Render on server (better for long clips)
        </label>
      )}

      <button
        type="button"
        onClick={runExport}
        disabled={running}
        className="inline-flex items-center justify-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white glow-accent disabled:opacity-60 disabled:shadow-none"
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {stage === "loading" ? "Loading engine…" : "Encoding…"}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" aria-hidden />
            Export MP4
          </>
        )}
      </button>

      {running && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full accent-gradient transition-[width] duration-200"
            style={{
              width:
                stage === "loading" ? "8%" : `${Math.round(progress * 100)}%`,
            }}
          />
        </div>
      )}

      {step.status === "error" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-red-500">{step.error}</p>
          <button
            type="button"
            onClick={runExport}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {step.status === "done" && exportUrl && (
        <a
          href={exportUrl}
          download="creatorcut.mp4"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download MP4
        </a>
      )}

      <p className="border-t border-foreground/10 pt-2 text-[11px] text-foreground/40">
        {cost.breakdown[0]}.
        {edl.captions.enabled
          ? " Captions are burned into the exported file."
          : " Captions are off — turn them on to burn them in."}
      </p>
    </div>
  );
}
