"use client";

import { useRef } from "react";
import { Film, Music, ImagePlus, Clapperboard, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { formatBytes, formatDuration, cn } from "@/lib/utils";
import { UploadDropzone } from "./upload-dropzone";

/**
 * Left rail — media. The source video (Phase 1) plus the user's own background
 * music and image/logo overlays (Phase 5).
 */
export function MediaPanel() {
  const video = useEditorStore((s) => s.video);
  const reset = useEditorStore((s) => s.reset);

  if (!video) {
    return <UploadDropzone />;
  }

  const resolution = video.width ? `${video.width}×${video.height}` : "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl border border-foreground/10 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
          <Film className="h-4 w-4 text-foreground/60" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={video.fileName}>
            {video.fileName}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50">
            {formatDuration(video.duration)} · {resolution} ·{" "}
            {formatBytes(video.fileSize)}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md p-1 text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
          aria-label="Remove video"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <MusicSection />
      <ImagesSection />
      <BrollSection />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
      {children}
    </h3>
  );
}

function MusicSection() {
  const music = useEditorStore((s) => s.music);
  const addMusic = useEditorStore((s) => s.addMusic);
  const setMusicVolume = useEditorStore((s) => s.setMusicVolume);
  const removeMusic = useEditorStore((s) => s.removeMusic);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Music</SectionLabel>
      {!music ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/15 px-3 py-2 text-xs font-medium hover:border-foreground/30"
        >
          <Music className="h-3.5 w-3.5" aria-hidden />
          Add background music
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-3">
          <div className="flex items-center gap-2">
            <Music className="h-3.5 w-3.5 shrink-0 text-foreground/50" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs" title={music.fileName}>
              {music.fileName}
            </span>
            <button
              type="button"
              onClick={removeMusic}
              className="rounded p-0.5 text-foreground/40 hover:text-foreground"
              aria-label="Remove music"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-foreground/50">
            Vol
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music.volume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="flex-1 accent-foreground"
            />
            <span className="w-7 text-right tabular-nums">
              {Math.round(music.volume * 100)}%
            </span>
          </label>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addMusic(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// 3×3 position grid → x/y percentages.
const POSITIONS = [
  [8, 8], [50, 8], [92, 8],
  [8, 50], [50, 50], [92, 50],
  [8, 88], [50, 88], [92, 88],
] as const;

function ImagesSection() {
  const images = useEditorStore((s) => s.images);
  const addImage = useEditorStore((s) => s.addImage);
  const setImagePosition = useEditorStore((s) => s.setImagePosition);
  const removeImage = useEditorStore((s) => s.removeImage);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Logo &amp; images</SectionLabel>

      {images.map((im) => (
        <div key={im.id} className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-3">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-3.5 w-3.5 shrink-0 text-foreground/50" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs" title={im.fileName}>
              {im.fileName}
            </span>
            <button
              type="button"
              onClick={() => removeImage(im.id)}
              className="rounded p-0.5 text-foreground/40 hover:text-foreground"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-foreground/50">Position</span>
            <div className="grid grid-cols-3 gap-0.5">
              {POSITIONS.map(([x, y]) => (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  onClick={() => setImagePosition(im.id, x, y)}
                  aria-label={`Position ${x},${y}`}
                  className={cn(
                    "h-3.5 w-3.5 rounded-sm border",
                    im.x === x && im.y === y
                      ? "border-transparent accent-gradient"
                      : "border-foreground/20 hover:bg-foreground/10",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/15 px-3 py-2 text-xs font-medium hover:border-foreground/30"
      >
        <ImagePlus className="h-3.5 w-3.5" aria-hidden />
        Add logo or image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addImage(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function BrollSection() {
  const broll = useEditorStore((s) => s.broll);
  const addBroll = useEditorStore((s) => s.addBroll);
  const setBrollStart = useEditorStore((s) => s.setBrollStart);
  const removeBroll = useEditorStore((s) => s.removeBroll);
  const inputRef = useRef<HTMLInputElement>(null);

  // read the clip's duration from a throwaway <video> before adding it
  function handleFile(file: File) {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    const url = URL.createObjectURL(file);
    const done = (d: number) => {
      addBroll(file, Number.isFinite(d) && d > 0 ? d : 5);
      URL.revokeObjectURL(url);
    };
    probe.onloadedmetadata = () => done(probe.duration);
    probe.onerror = () => done(5);
    probe.src = url;
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>B-roll cutaways</SectionLabel>

      {broll.map((b) => (
        <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-3">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-3.5 w-3.5 shrink-0 text-foreground/50" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs" title={b.fileName}>
              {b.fileName}
            </span>
            <button
              type="button"
              onClick={() => removeBroll(b.id)}
              className="rounded p-0.5 text-foreground/40 hover:text-foreground"
              aria-label="Remove b-roll"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-foreground/50">
            Start at
            <input
              type="number"
              min={0}
              step={0.5}
              value={b.start}
              onChange={(e) => setBrollStart(b.id, Math.max(0, Number(e.target.value)))}
              className="w-16 rounded border border-foreground/15 bg-transparent px-2 py-1 text-right tabular-nums"
            />
            s · covers {formatDuration(b.duration)}
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/15 px-3 py-2 text-xs font-medium hover:border-foreground/30"
      >
        <Clapperboard className="h-3.5 w-3.5" aria-hidden />
        Add b-roll clip
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
