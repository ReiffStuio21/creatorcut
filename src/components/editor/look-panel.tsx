"use client";

import { useEditorStore } from "@/lib/store/editor";
import { FILTERS } from "@/lib/filters";
import { cn } from "@/lib/utils";

/** Color look picker (Phase 7) — applies to the preview and the export. */
export function LookPanel() {
  const video = useEditorStore((s) => s.video);
  const filter = useEditorStore((s) => s.filter);
  const setFilter = useEditorStore((s) => s.setFilter);

  if (!video) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
        Upload a video to choose a look.
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setFilter(f.id)}
          className={cn(
            "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
            filter === f.id
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/15 hover:bg-foreground/5",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
