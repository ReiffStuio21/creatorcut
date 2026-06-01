import Link from "next/link";
import { MediaPanel } from "@/components/editor/media-panel";
import { PreviewPlayer } from "@/components/editor/preview-player";
import { TranscriptPanel } from "@/components/editor/transcript-panel";
import { CaptionsPanel } from "@/components/editor/captions-panel";
import { ExportPanel } from "@/components/editor/export-panel";
import { HeaderExportButton } from "@/components/editor/header-export-button";

/**
 * Editor — the three-panel layout from PLAN.md §4.
 * Left: media tray. Center: preview + transcript editor. Right: captions + export.
 */
export default function EditorPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            CreatorCut
          </Link>
          <span className="text-xs text-foreground/40">Untitled project</span>
        </div>
        <HeaderExportButton />
      </header>

      <div className="grid flex-1 grid-cols-[220px_1fr_300px] divide-x divide-foreground/10">
        {/* Left — media tray (Phase 1 upload; music/images Phase 5) */}
        <aside className="flex flex-col gap-3 p-4">
          <PanelLabel>Media</PanelLabel>
          <MediaPanel />
        </aside>

        {/* Center — preview + transcript (Phases 1–3) */}
        <section className="flex flex-col gap-4 p-4">
          <PreviewPlayer />
          <div className="flex-1 rounded-xl border border-foreground/10 p-4">
            <TranscriptPanel />
          </div>
        </section>

        {/* Right — captions + cost meter (Phases 4 & 4d) */}
        <aside className="flex flex-col gap-4 p-4">
          <div>
            <PanelLabel>Captions</PanelLabel>
            <CaptionsPanel />
          </div>
          <div>
            <PanelLabel>Export</PanelLabel>
            <ExportPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
      {children}
    </h2>
  );
}
