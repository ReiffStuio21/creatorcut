import Link from "next/link";
import { MediaPanel } from "@/components/editor/media-panel";
import { PreviewPlayer } from "@/components/editor/preview-player";
import { TranscriptPanel } from "@/components/editor/transcript-panel";
import { CaptionsPanel } from "@/components/editor/captions-panel";
import { ExportPanel } from "@/components/editor/export-panel";
import { LookPanel } from "@/components/editor/look-panel";
import { HeaderExportButton } from "@/components/editor/header-export-button";
import { SaveButton } from "@/components/editor/save-button";
import { ProjectLoader } from "@/components/editor/project-loader";
import { OnboardingHint } from "@/components/editor/onboarding-hint";

/**
 * Editor — the three-panel layout from PLAN.md §4 (stacks on narrow screens).
 * Left: media tray. Center: preview + transcript editor. Right: look, captions, export.
 */
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            CreatorCut
          </Link>
          <Link
            href="/dashboard"
            className="hidden text-xs text-foreground/50 hover:text-foreground sm:inline"
          >
            Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <SaveButton />
          <HeaderExportButton />
        </div>
      </header>

      {project && <ProjectLoader projectId={project} />}
      <OnboardingHint />

      <div className="flex flex-1 flex-col divide-y divide-foreground/10 lg:grid lg:grid-cols-[220px_1fr_300px] lg:divide-x lg:divide-y-0">
        {/* Left — media tray (upload; music/images) */}
        <aside className="flex flex-col gap-3 p-4">
          <PanelLabel>Media</PanelLabel>
          <MediaPanel />
        </aside>

        {/* Center — preview + transcript */}
        <section className="flex flex-col gap-4 p-4">
          <PreviewPlayer />
          <div className="min-h-48 flex-1 rounded-xl border border-foreground/10 p-4">
            <TranscriptPanel />
          </div>
        </section>

        {/* Right — look, captions, export */}
        <aside className="flex flex-col gap-4 p-4">
          <div>
            <PanelLabel>Look</PanelLabel>
            <LookPanel />
          </div>
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
