"use client";

import { useEditorStore } from "@/lib/store/editor";

/**
 * A one-line, state-aware hint guiding a first-time user through the core loop
 * (upload → cut → export). Quiet once they're exporting.
 */
export function OnboardingHint() {
  const video = useEditorStore((s) => s.video);
  const edl = useEditorStore((s) => s.edl);
  const exported = useEditorStore((s) => s.exportStep.status === "done");

  let step = 1;
  let message = "Step 1 — drop a video on the left to begin.";
  if (video && !edl) {
    step = 2;
    message = "Step 2 — generate the transcript, then click words to cut them.";
  } else if (edl && !exported) {
    step = 3;
    message = "Step 3 — pick a look and captions, then Export MP4.";
  } else if (exported) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-xs text-foreground/60">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
        {step}
      </span>
      {message}
    </div>
  );
}
