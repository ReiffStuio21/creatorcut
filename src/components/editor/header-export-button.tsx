"use client";

import { Download, Loader2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";

/** Primary export CTA in the editor header; mirrors the export panel state. */
export function HeaderExportButton() {
  const edl = useEditorStore((s) => s.edl);
  const step = useEditorStore((s) => s.exportStep);
  const runExport = useEditorStore((s) => s.runExport);
  const running = step.status === "running";

  return (
    <button
      type="button"
      onClick={runExport}
      disabled={!edl || running}
      className="inline-flex items-center gap-2 rounded-full accent-gradient px-4 py-1.5 text-sm font-medium text-white glow-accent disabled:opacity-40 disabled:shadow-none"
    >
      {running ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4" aria-hidden />
      )}
      Export MP4
    </button>
  );
}
