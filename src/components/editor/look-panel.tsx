"use client";

import { useEditorStore } from "@/lib/store/editor";
import { FILTERS } from "@/lib/filters";
import { cn } from "@/lib/utils";

/** Color look picker (Phase 7) — applies to the preview and the export. */
const TRANSITIONS = [
  { id: "cut", label: "Cut" },
  { id: "fade", label: "Fade" },
] as const;

export function LookPanel() {
  const video = useEditorStore((s) => s.video);
  const filter = useEditorStore((s) => s.filter);
  const setFilter = useEditorStore((s) => s.setFilter);
  const transition = useEditorStore((s) => s.transition);
  const setTransition = useEditorStore((s) => s.setTransition);
  const enhance = useEditorStore((s) => s.enhance);
  const setEnhance = useEditorStore((s) => s.setEnhance);

  if (!video) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
        Upload a video to choose a look.
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      <label className="flex items-center justify-between rounded-md border border-foreground/10 px-2.5 py-1.5 text-xs">
        <span className="font-medium">✨ Auto enhance</span>
        <input
          type="checkbox"
          checked={enhance}
          onChange={(e) => setEnhance(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
      </label>

      <div className="grid grid-cols-3 gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
              filter === f.id
                ? "border-transparent accent-gradient text-white"
                : "border-foreground/15 hover:bg-foreground/5",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-foreground/50">Transition</span>
        <div className="flex flex-1 gap-1.5">
          {TRANSITIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTransition(t.id)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                transition === t.id
                  ? "border-transparent accent-gradient text-white"
                  : "border-foreground/15 hover:bg-foreground/5",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
