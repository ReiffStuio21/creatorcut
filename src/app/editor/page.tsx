import Link from "next/link";
import { MediaPanel } from "@/components/editor/media-panel";
import { PreviewPlayer } from "@/components/editor/preview-player";

/**
 * Editor — the three-panel layout from PLAN.md §4.
 * Left: media tray. Center: preview + transcript editor. Right: panel (captions,
 * cost meter). Phase 1 wires upload + preview; transcript/captions land next.
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
        <button
          className="cursor-not-allowed rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background opacity-50"
          disabled
        >
          Export MP4
        </button>
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
            <PanelLabel>Transcript</PanelLabel>
            <p className="mt-2 text-sm text-foreground/40">
              Your words appear here. Delete a line to cut the video. One click
              removes filler words. — Phases 2–3
            </p>
          </div>
        </section>

        {/* Right — captions + cost meter (Phases 4 & 4d) */}
        <aside className="flex flex-col gap-4 p-4">
          <div>
            <PanelLabel>Captions</PanelLabel>
            <Placeholder>Style presets &amp; sync — Phase 4</Placeholder>
          </div>
          <div>
            <PanelLabel>Cost meter</PanelLabel>
            <Placeholder>Estimated API spend this project — $0.00</Placeholder>
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

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
      {children}
    </div>
  );
}
