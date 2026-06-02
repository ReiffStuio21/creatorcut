"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/lib/store/editor";
import { buildCaptionCues } from "@/lib/captions/cues";
import type { CaptionStyle } from "@/lib/edl/types";
import { cn } from "@/lib/utils";

const STYLES: { value: CaptionStyle; label: string }[] = [
  { value: "bold-bottom", label: "Bold" },
  { value: "clean-bottom", label: "Clean" },
  { value: "boxed-center", label: "Boxed" },
];

const COLORS = ["#FFFFFF", "#FACC15", "#22D3EE", "#000000"];

export function CaptionsPanel() {
  const edl = useEditorStore((s) => s.edl);
  const setCaptions = useEditorStore((s) => s.setCaptions);
  const cues = useMemo(() => (edl ? buildCaptionCues(edl) : []), [edl]);

  if (!edl) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
        Generate a transcript to add captions.
      </div>
    );
  }

  const { enabled, style, color } = edl.captions;

  return (
    <div className="mt-2 flex flex-col gap-3">
      <label className="flex items-center justify-between text-sm">
        <span>Show captions</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setCaptions({ enabled: e.target.checked })}
          className="h-4 w-4 accent-foreground"
        />
      </label>

      <div className={cn("flex flex-col gap-2", !enabled && "opacity-40")}>
        <div className="flex gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={!enabled}
              onClick={() => setCaptions({ style: s.value })}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                style === s.value
                  ? "border-transparent accent-gradient text-white"
                  : "border-foreground/15 hover:bg-foreground/5",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/50">Color</span>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!enabled}
                onClick={() => setCaptions({ color: c })}
                aria-label={`Caption color ${c}`}
                className={cn(
                  "h-5 w-5 rounded-full border",
                  color === c ? "ring-2 ring-foreground ring-offset-1" : "border-foreground/20",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-foreground/40">
        {cues.length} caption {cues.length === 1 ? "line" : "lines"} · synced to the cut
      </p>
    </div>
  );
}
