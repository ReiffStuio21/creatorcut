import { create } from "zustand";
import type { Transcript } from "@/lib/transcription/provider";
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

  // preview wiring: the live <video> element, registered by PreviewPlayer
  videoEl: HTMLVideoElement | null;

  loadFile: (file: File) => void;
  setMetadata: (meta: { duration: number; width: number; height: number }) => void;
  runTranscribe: () => Promise<void>;
  setVideoEl: (el: HTMLVideoElement | null) => void;
  seekTo: (seconds: number) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  video: null,
  transcript: null,
  transcribe: idleStep,
  videoEl: null,

  loadFile: (file) => {
    const prev = get().video;
    if (prev) URL.revokeObjectURL(prev.url);
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
      // new source → previous transcript no longer applies
      transcript: null,
      transcribe: idleStep,
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
      set({ transcript, transcribe: doneStep() });
    } catch (e) {
      set({
        transcribe: errorStep(e instanceof Error ? e.message : "Unknown error"),
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
    set({ video: null, transcript: null, transcribe: idleStep });
  },
}));
