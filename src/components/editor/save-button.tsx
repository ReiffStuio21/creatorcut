"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Save } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { saveProject } from "@/lib/projects/client";

/** Save the current edit to Supabase (visible once there's something to save). */
export function SaveButton() {
  const video = useEditorStore((s) => s.video);
  const edl = useEditorStore((s) => s.edl);
  const filter = useEditorStore((s) => s.filter);
  const projectId = useEditorStore((s) => s.projectId);
  const setProjectId = useEditorStore((s) => s.setProjectId);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [needsAuth, setNeedsAuth] = useState(false);

  if (!video || !edl) return null;

  const onSave = async () => {
    setStatus("saving");
    setNeedsAuth(false);
    try {
      const id = await saveProject({
        projectId: projectId ?? undefined,
        title: video.fileName,
        videoFile: video.file,
        videoMeta: {
          fileName: video.fileName,
          fileSize: video.fileSize,
          duration: video.duration,
          width: video.width,
          height: video.height,
        },
        edl: { ...edl, filter },
      });
      setProjectId(id);
      setStatus("saved");
    } catch (e) {
      if (e instanceof Error && /not signed in/i.test(e.message)) setNeedsAuth(true);
      setStatus("error");
    }
  };

  if (needsAuth) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
      >
        Log in to save
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={status === "saving"}
      className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-60"
    >
      {status === "saving" ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : status === "saved" ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Save className="h-4 w-4" aria-hidden />
      )}
      {status === "saved" ? "Saved" : status === "error" ? "Retry save" : "Save"}
    </button>
  );
}
