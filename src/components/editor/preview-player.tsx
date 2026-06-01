"use client";

import { useEditorStore } from "@/lib/store/editor";

/**
 * Center preview. Phase 1 plays the raw source and reads its metadata.
 * Phase 3 makes it read the EDL and skip un-kept segments.
 */
export function PreviewPlayer() {
  const video = useEditorStore((s) => s.video);
  const setMetadata = useEditorStore((s) => s.setMetadata);

  if (!video) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-foreground/15 text-sm text-foreground/40">
        Upload a video to preview it here
      </div>
    );
  }

  return (
    <video
      key={video.id}
      src={video.url}
      controls
      playsInline
      className="aspect-video w-full rounded-xl bg-black"
      onLoadedMetadata={(e) => {
        const el = e.currentTarget;
        setMetadata({
          duration: el.duration,
          width: el.videoWidth,
          height: el.videoHeight,
        });
      }}
    />
  );
}
