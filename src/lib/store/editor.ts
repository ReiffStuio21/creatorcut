import { create } from "zustand";
import type { Transcript } from "@/lib/transcription/provider";
import type { AspectRatio, CaptionConfig, EDL } from "@/lib/edl/types";
import { edlFromTranscript } from "@/lib/edl/from-transcript";
import {
  applyCleanup,
  setAllKept,
  setSegmentKept,
} from "@/lib/edl/operations";
import {
  doneStep,
  errorStep,
  idleStep,
  runningStep,
  type StepState,
} from "@/lib/pipeline/types";

/**
 * The loaded source video lives in browser memory (object URL + the File for
 * later FFmpeg.wasm work). Metadata (duration/resolution) is filled in by the
 * preview player once the browser decodes the file header.
 */
export interface LoadedVideo {
  id: string;
  url: string; // object URL — must be revoked when replaced/cleared
  file: File;
  fileName: string;
  fileSize: number;
  /** seconds — 0 until metadata loads */
  duration: number;
  width: number;
  height: number;
}

interface EditorState {
  video: LoadedVideo | null;

  // AI pipeline — step 1: transcription (PLAN.md §4c)
  transcript: Transcript | null;
  transcribe: StepState;

  // The edit decision list — single source of truth for the cut (PLAN.md §4a)
  edl: EDL | null;
  aspectRatio: AspectRatio;

  // Export (Phase 6) — WasmRenderer turns the EDL into a downloadable MP4
  exportStep: StepState;
  exportStage: "loading" | "encoding" | null;
  exportProgress: number; // 0..1
  exportUrl: string | null; // object URL of the finished MP4

  // preview wiring: the live <video> element, registered by PreviewPlayer
  videoEl: HTMLVideoElement | null;

  loadFile: (file: File) => void;
  setMetadata: (meta: { duration: number; width: number; height: number }) => void;
  runTranscribe: () => Promise<void>;
  toggleSegment: (id: string) => void;
  cleanup: () => void;
  restoreAll: () => void;
  setCaptions: (patch: Partial<CaptionConfig>) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  runExport: () => Promise<void>;
  setVideoEl: (el: HTMLVideoElement | null) => void;
  seekTo: (seconds: number) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  video: null,
  transcript: null,
  transcribe: idleStep,
  edl: null,
  aspectRatio: "9:16",
  exportStep: idleStep,
  exportStage: null,
  exportProgress: 0,
  exportUrl: null,
  videoEl: null,

  loadFile: (file) => {
    const prev = get().video;
    if (prev) URL.revokeObjectURL(prev.url);
    const prevExport = get().exportUrl;
    if (prevExport) URL.revokeObjectURL(prevExport);
    set({
      video: {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        file,
        fileName: file.name,
        fileSize: file.size,
        duration: 0,
        width: 0,
        height: 0,
      },
      // new source → previous transcript/edit no longer applies
      transcript: null,
      transcribe: idleStep,
      edl: null,
      exportStep: idleStep,
      exportStage: null,
      exportProgress: 0,
      exportUrl: null,
    });
  },

  setMetadata: (meta) =>
    set((s) => (s.video ? { video: { ...s.video, ...meta } } : s)),

  runTranscribe: async () => {
    const video = get().video;
    if (!video || get().transcribe.status === "running") return;
    set({ transcribe: runningStep() });
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds: video.duration }),
      });
      if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
      const transcript: Transcript = await res.json();
      set({
        transcript,
        edl: edlFromTranscript(transcript, video.id, get().aspectRatio),
        transcribe: doneStep(),
      });
    } catch (e) {
      set({
        transcribe: errorStep(e instanceof Error ? e.message : "Unknown error"),
      });
    }
  },

  toggleSegment: (id) =>
    set((s) => {
      if (!s.edl) return s;
      const seg = s.edl.segments.find((x) => x.id === id);
      if (!seg) return s;
      return { edl: setSegmentKept(s.edl, id, !seg.kept) };
    }),

  cleanup: () => set((s) => (s.edl ? { edl: applyCleanup(s.edl) } : s)),

  restoreAll: () => set((s) => (s.edl ? { edl: setAllKept(s.edl, true) } : s)),

  setCaptions: (patch) =>
    set((s) =>
      s.edl
        ? { edl: { ...s.edl, captions: { ...s.edl.captions, ...patch } } }
        : s,
    ),

  setAspectRatio: (aspectRatio) =>
    set((s) => ({
      aspectRatio,
      edl: s.edl ? { ...s.edl, aspectRatio } : s.edl,
    })),

  runExport: async () => {
    const { video, edl } = get();
    if (!video || !edl || get().exportStep.status === "running") return;

    const prevUrl = get().exportUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({
      exportStep: runningStep(),
      exportStage: "loading",
      exportProgress: 0,
      exportUrl: null,
    });

    try {
      // Dynamic import keeps the heavy FFmpeg bundle out of initial page load.
      const { WasmRenderer } = await import("@/lib/render/wasm-renderer");
      const renderer = new WasmRenderer({
        onStage: (stage) => set({ exportStage: stage }),
        onProgress: (value) => set({ exportProgress: value }),
      });
      const blob = await renderer.render(edl, {
        id: video.id,
        url: video.url,
        duration: video.duration,
        width: video.width,
        height: video.height,
      });
      set({
        exportUrl: URL.createObjectURL(blob),
        exportStep: doneStep(),
        exportStage: null,
        exportProgress: 1,
      });
    } catch (e) {
      set({
        exportStep: errorStep(e instanceof Error ? e.message : "Export failed"),
        exportStage: null,
      });
    }
  },

  setVideoEl: (el) => set({ videoEl: el }),

  seekTo: (seconds) => {
    const el = get().videoEl;
    if (el) {
      el.currentTime = seconds;
      void el.play().catch(() => {});
    }
  },

  reset: () => {
    const prev = get().video;
    if (prev) URL.revokeObjectURL(prev.url);
    const prevExport = get().exportUrl;
    if (prevExport) URL.revokeObjectURL(prevExport);
    set({
      video: null,
      transcript: null,
      transcribe: idleStep,
      edl: null,
      exportStep: idleStep,
      exportStage: null,
      exportProgress: 0,
      exportUrl: null,
    });
  },
}));
