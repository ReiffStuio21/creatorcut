"use client";

import { useEditorStore } from "@/lib/store/editor";
import { TEMPLATES } from "@/lib/templates";

/** One-tap style templates (aspect + look + transition + captions + enhance). */
export function TemplatesPanel() {
  const video = useEditorStore((s) => s.video);
  const applyTemplate = useEditorStore((s) => s.applyTemplate);

  if (!video) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
        Upload a video to start from a template.
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => applyTemplate(t)}
          className="flex items-center gap-2 rounded-lg border border-foreground/15 px-2.5 py-2 text-left text-xs font-medium transition-colors hover:border-accent/50 hover:bg-foreground/5"
        >
          <span aria-hidden>{t.emoji}</span>
          {t.name}
        </button>
      ))}
    </div>
  );
}
