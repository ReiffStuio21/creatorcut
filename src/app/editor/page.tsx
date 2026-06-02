import Link from "next/link";
import { MediaPanel } from "@/components/editor/media-panel";
import { PreviewPlayer } from "@/components/editor/preview-player";
import { TranscriptPanel } from "@/components/editor/transcript-panel";
import { Timeline } from "@/components/editor/timeline";
import { CaptionsPanel } from "@/components/editor/captions-panel";
import { ExportPanel } from "@/components/editor/export-panel";
import { LookPanel } from "@/components/editor/look-panel";
import { BackgroundPanel } from "@/components/editor/background-panel";
import { VoiceoverPanel } from "@/components/editor/voiceover-panel";
import { TemplatesPanel } from "@/components/editor/templates-panel";
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
      <header className="flex items-center justify-between border-b border-foreground/10 bg-panel/40 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="h-2 w-2 rounded-full accent-gradient shadow-[0_0_10px_2px_rgba(124,92,255,0.7)]" />
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
          <Timeline />
          <div className="min-h-48 flex-1 rounded-xl border border-foreground/10 p-4">
            <TranscriptPanel />
          </div>
        </section>

        {/* Right — look, captions, export */}
        <aside className="flex flex-col gap-4 p-4">
          <div>
            <PanelLabel>Templates</PanelLabel>
            <TemplatesPanel />
          </div>
          <div>
            <PanelLabel>Background</PanelLabel>
            <BackgroundPanel />
          </div>
          <div>
            <PanelLabel>Look</PanelLabel>
            <LookPanel />
          </div>
          <div>
            <PanelLabel>Voiceover</PanelLabel>
            <VoiceoverPanel />
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
