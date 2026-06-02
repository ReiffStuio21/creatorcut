"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

const COLORS = ["#22c55e", "#2563eb", "#ffffff", "#000000"];

/** On-device AI background removal — color or blur, baked into the clip. */
export function BackgroundPanel() {
  const video = useEditorStore((s) => s.video);
  const bgColor = useEditorStore((s) => s.bgColor);
  const setBgColor = useEditorStore((s) => s.setBgColor);
  const mode = useEditorStore((s) => s.backgroundMode);
  const step = useEditorStore((s) => s.removeBg);
  const progress = useEditorStore((s) => s.removeBgProgress);
  const run = useEditorStore((s) => s.runRemoveBackground);
  const restore = useEditorStore((s) => s.restoreBackground);

  if (!video) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
        Upload a video to remove its background.
      </div>
    );
  }

  const running = step.status === "running";

  if (running) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <p className="inline-flex items-center gap-2 text-xs text-foreground/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Processing background… {Math.round(progress * 100)}%
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full accent-gradient" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="text-[11px] text-foreground/40">
          Runs on your device in real time — about as long as the clip.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-foreground/50">Color</span>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBgColor(c)}
              aria-label={`Background ${c}`}
              className={cn(
                "h-5 w-5 rounded-full border",
                bgColor === c ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : "border-foreground/20",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => run("color")}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md accent-gradient px-2 py-1.5 text-xs font-medium text-white"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Replace
        </button>
        <button
          type="button"
          onClick={() => run("blur")}
          className="flex-1 rounded-md border border-foreground/15 px-2 py-1.5 text-xs font-medium hover:bg-foreground/5"
        >
          Blur
        </button>
        {mode !== "none" && (
          <button
            type="button"
            onClick={restore}
            className="rounded-md border border-foreground/15 px-2 py-1.5 text-xs font-medium hover:bg-foreground/5"
          >
            Original
          </button>
        )}
      </div>

      {step.status === "error" && (
        <p className="text-[11px] text-red-500">{step.error}</p>
      )}
      <p className="text-[11px] text-foreground/40">
        On-device AI · keeps your audio · applied to the clip.
      </p>
    </div>
  );
}
