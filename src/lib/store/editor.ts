import { create } from "zustand";
import type { Transcript } from "@/lib/transcription/provider";
import type {
  AspectRatio,
  CaptionConfig,
  EDL,
  TransitionId,
  VideoFilterId,
} from "@/lib/edl/types";
import { edlFromTranscript } from "@/lib/edl/from-transcript";
import {
  applyCleanup,
  outputDuration,
  setAllKept,
  setSegmentKept,
  splitSegment,
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

/** A background music track the user uploaded (Phase 5). */
export interface MusicAsset {
  id: string;
  url: string; // object URL
  fileName: string;
  /** 0..1 */
  volume: number;
}

/** An image/logo overlay (Phase 5). x/y are % of the frame, 0..100. */
export interface ImageAsset {
  id: string;
  url: string; // object URL
  fileName: string;
  x: number;
  y: number;
}

/** A b-roll cutaway clip (Phase 8). Covers [start, start+duration] of output. */
export interface BrollAsset {
  id: string;
  url: string; // object URL
  fileName: string;
  start: number;
  duration: number;
}

interface EditorState {
  video: LoadedVideo | null;

  // AI pipeline — step 1: transcription (PLAN.md §4c)
  transcript: Transcript | null;
  transcribe: StepState;

  // The edit decision list — single source of truth for the cut (PLAN.md §4a)
  edl: EDL | null;
  aspectRatio: AspectRatio;
  /** master audio volume for the video's own sound, 0..1.5 */
  videoVolume: number;
  /** currently selected timeline clip */
  selectedSegmentId: string | null;

  // User media (Phase 5/8) — folded into edl.tracks at export time
  music: MusicAsset | null;
  images: ImageAsset[];
  broll: BrollAsset[];

  // Color look + transition (Phase 7 / 8)
  filter: VideoFilterId;
  transition: TransitionId;

  // Background removal (on-device). originalVideo snapshots the pre-bake source
  // so mode switches re-bake from the original and "Off" restores it.
  backgroundMode: "none" | "color" | "blur";
  bgColor: string;
  originalVideo: LoadedVideo | null;
  removeBg: StepState;
  removeBgProgress: number;

  // Export — WasmRenderer (browser) or ServerRenderer (worker) → downloadable MP4
  serverRender: boolean;
  exportStep: StepState;
  exportStage: "loading" | "encoding" | null;
  exportProgress: number; // 0..1
  exportUrl: string | null; // object URL of the finished MP4

  // Persistence (Supabase) — set when a saved project is loaded/saved
  projectId: string | null;

  // preview wiring: the live <video> element + playhead time (output preview)
  videoEl: HTMLVideoElement | null;
  currentTime: number;

  loadFile: (file: File) => void;
  setMetadata: (meta: { duration: number; width: number; height: number }) => void;
  runTranscribe: () => Promise<void>;
  toggleSegment: (id: string) => void;
  cleanup: () => void;
  restoreAll: () => void;
  splitAtPlayhead: () => void;
  selectSegment: (id: string | null) => void;
  setVideoVolume: (volume: number) => void;
  setCaptions: (patch: Partial<CaptionConfig>) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  addMusic: (file: File) => void;
  setMusicVolume: (volume: number) => void;
  removeMusic: () => void;
  addImage: (file: File) => void;
  setImagePosition: (id: string, x: number, y: number) => void;
  removeImage: (id: string) => void;
  addBroll: (file: File, duration: number) => void;
  setBrollStart: (id: string, start: number) => void;
  removeBroll: (id: string) => void;
  setFilter: (filter: VideoFilterId) => void;
  setTransition: (transition: TransitionId) => void;
  setBgColor: (color: string) => void;
  runRemoveBackground: (mode: "color" | "blur") => Promise<void>;
  restoreBackground: () => void;
  setServerRender: (on: boolean) => void;
  setProjectId: (id: string) => void;
  hydrateProject: (p: {
    id: string;
    file: File;
    meta: { fileName?: string; fileSize?: number; duration?: number; width?: number; height?: number };
    edl: EDL;
    music?: { file: File; fileName: string; volume: number };
    images?: { file: File; fileName: string; x: number; y: number }[];
  }) => void;
  runExport: () => Promise<void>;
  setVideoEl: (el: HTMLVideoElement | null) => void;
  setCurrentTime: (t: number) => void;
  seekTo: (seconds: number) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  video: null,
  transcript: null,
  transcribe: idleStep,
  edl: null,
  aspectRatio: "9:16",
  videoVolume: 1,
  selectedSegmentId: null,
  music: null,
  images: [],
  broll: [],
  filter: "none",
  transition: "cut",
  backgroundMode: "none",
  bgColor: "#22c55e",
  originalVideo: null,
  removeBg: idleStep,
  removeBgProgress: 0,
  serverRender: false,
  projectId: null,
  exportStep: idleStep,
  exportStage: null,
  exportProgress: 0,
  exportUrl: null,
  videoEl: null,
  currentTime: 0,

  loadFile: (file) => {
    const prev = get().video;
    if (prev) URL.revokeObjectURL(prev.url);
    const prevExport = get().exportUrl;
    if (prevExport) URL.revokeObjectURL(prevExport);
    const prevOrig = get().originalVideo;
    if (prevOrig && prevOrig !== prev) URL.revokeObjectURL(prevOrig.url);
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
      videoVolume: 1,
      selectedSegmentId: null,
      backgroundMode: "none",
      originalVideo: null,
      removeBg: idleStep,
      removeBgProgress: 0,
      projectId: null,
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
      // When real transcription is enabled, send compact extracted audio so the
      // server can call the provider; otherwise post duration for the dev mock.
      const realEnabled =
        process.env.NEXT_PUBLIC_TRANSCRIPTION_ENABLED === "true";
      let res: Response;
      if (realEnabled) {
        const { extractAudioMp3 } = await import(
          "@/lib/transcription/extract-audio"
        );
        const audio = await extractAudioMp3(video.url);
        res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "audio/mpeg" },
          body: audio as BodyInit,
        });
      } else {
        res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationSeconds: video.duration }),
        });
      }
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

  splitAtPlayhead: () =>
    set((s) => {
      if (!s.edl || !s.videoEl) return s;
      const t = s.videoEl.currentTime;
      const seg = s.edl.segments.find((x) => t > x.start && t < x.end);
      if (!seg) return s;
      return { edl: splitSegment(s.edl, seg.id, t), selectedSegmentId: `${seg.id}-1` };
    }),

  selectSegment: (id) => set({ selectedSegmentId: id }),

  setVideoVolume: (volume) => set({ videoVolume: volume }),

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

  addMusic: (file) => {
    const prev = get().music;
    if (prev) URL.revokeObjectURL(prev.url);
    set({
      music: {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        fileName: file.name,
        volume: 0.3,
      },
    });
  },

  setMusicVolume: (volume) =>
    set((s) => (s.music ? { music: { ...s.music, volume } } : s)),

  removeMusic: () => {
    const prev = get().music;
    if (prev) URL.revokeObjectURL(prev.url);
    set({ music: null });
  },

  addImage: (file) =>
    set((s) => ({
      images: [
        ...s.images,
        {
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          fileName: file.name,
          x: 50, // default: centered
          y: 12, // near the top
        },
      ],
    })),

  setImagePosition: (id, x, y) =>
    set((s) => ({
      images: s.images.map((im) => (im.id === id ? { ...im, x, y } : im)),
    })),

  removeImage: (id) =>
    set((s) => {
      const target = s.images.find((im) => im.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return { images: s.images.filter((im) => im.id !== id) };
    }),

  addBroll: (file, duration) =>
    set((s) => ({
      broll: [
        ...s.broll,
        {
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          fileName: file.name,
          start: 0,
          duration,
        },
      ],
    })),

  setBrollStart: (id, start) =>
    set((s) => ({
      broll: s.broll.map((b) => (b.id === id ? { ...b, start } : b)),
    })),

  removeBroll: (id) =>
    set((s) => {
      const target = s.broll.find((b) => b.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return { broll: s.broll.filter((b) => b.id !== id) };
    }),

  setFilter: (filter) => set({ filter }),

  setTransition: (transition) => set({ transition }),

  setBgColor: (bgColor) => set({ bgColor }),

  runRemoveBackground: async (mode) => {
    const s = get();
    if (!s.video || s.removeBg.status === "running") return;
    // snapshot the original on first use so re-bakes start from it
    const original = s.originalVideo ?? s.video;
    set({
      backgroundMode: mode,
      originalVideo: original,
      removeBg: runningStep(),
      removeBgProgress: 0,
    });
    try {
      const { removeBackground } = await import("@/lib/background/remove");
      const bg =
        mode === "blur"
          ? ({ type: "blur" } as const)
          : ({ type: "color", color: get().bgColor } as const);
      const blob = await removeBackground(original.url, bg, (p) =>
        set({ removeBgProgress: p }),
      );
      const prev = get().video;
      if (prev && prev !== get().originalVideo) URL.revokeObjectURL(prev.url);
      set({
        video: {
          ...original,
          id: crypto.randomUUID(),
          url: URL.createObjectURL(blob),
          file: new File([blob], original.fileName, { type: blob.type }),
          fileSize: blob.size,
        },
        removeBg: doneStep(),
        removeBgProgress: 1,
      });
    } catch (e) {
      set({
        removeBg: errorStep(
          e instanceof Error ? e.message : "Background removal failed",
        ),
      });
    }
  },

  restoreBackground: () =>
    set((s) => {
      if (!s.originalVideo) return { backgroundMode: "none" };
      if (s.video && s.video !== s.originalVideo) URL.revokeObjectURL(s.video.url);
      return {
        video: s.originalVideo,
        originalVideo: null,
        backgroundMode: "none",
        removeBg: idleStep,
        removeBgProgress: 0,
      };
    }),

  setServerRender: (on) => set({ serverRender: on }),

  setProjectId: (id) => set({ projectId: id }),

  hydrateProject: ({ id, file, meta, edl, music, images }) => {
    const s = get();
    if (s.video) URL.revokeObjectURL(s.video.url);
    if (s.exportUrl) URL.revokeObjectURL(s.exportUrl);
    if (s.music) URL.revokeObjectURL(s.music.url);
    s.images.forEach((im) => URL.revokeObjectURL(im.url));
    s.broll.forEach((b) => URL.revokeObjectURL(b.url));
    set({
      video: {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        file,
        fileName: meta.fileName ?? file.name,
        fileSize: meta.fileSize ?? file.size,
        duration: meta.duration ?? 0,
        width: meta.width ?? 0,
        height: meta.height ?? 0,
      },
      edl,
      aspectRatio: edl.aspectRatio,
      filter: edl.filter ?? "none",
      transition: edl.transition ?? "cut",
      videoVolume: edl.volume ?? 1,
      selectedSegmentId: null,
      transcript: null,
      transcribe: doneStep(),
      music: music
        ? {
            id: crypto.randomUUID(),
            url: URL.createObjectURL(music.file),
            fileName: music.fileName,
            volume: music.volume,
          }
        : null,
      images: (images ?? []).map((im) => ({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(im.file),
        fileName: im.fileName,
        x: im.x,
        y: im.y,
      })),
      broll: [],
      projectId: id,
      exportStep: idleStep,
      exportStage: null,
      exportProgress: 0,
      exportUrl: null,
    });
  },

  runExport: async () => {
    const { video, edl, music, images, broll, filter, transition, videoVolume } = get();
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
      // Fold the user's media into the EDL's tracks so the renderer (which reads
      // the EDL as the single source of truth) can mix/overlay them.
      const outDur = outputDuration(edl);
      const edlForExport: EDL = {
        ...edl,
        filter,
        transition,
        volume: videoVolume,
        tracks: {
          music: music
            ? [{ src: music.url, start: 0, volume: music.volume }]
            : [],
          images: images.map((im) => ({
            src: im.url,
            start: 0,
            end: outDur,
            x: im.x,
            y: im.y,
          })),
          broll: broll.map((b) => ({
            src: b.url,
            start: b.start,
            duration: b.duration,
          })),
        },
      };

      const sourceArg = {
        id: video.id,
        url: video.url,
        duration: video.duration,
        width: video.width,
        height: video.height,
      };

      // Pick the backend: the server worker (long clips) when enabled+configured,
      // else the in-browser FFmpeg.wasm. Same Renderer interface either way.
      const workerUrl = process.env.NEXT_PUBLIC_RENDER_WORKER_URL;
      let blob: Blob;
      if (get().serverRender && workerUrl) {
        const { ServerRenderer } = await import("@/lib/render/server-renderer");
        const renderer = new ServerRenderer(workerUrl, {
          onStage: (stage) => set({ exportStage: stage }),
        });
        blob = await renderer.render(edlForExport, sourceArg);
      } else {
        // Dynamic import keeps the heavy FFmpeg bundle out of initial page load.
        const { WasmRenderer } = await import("@/lib/render/wasm-renderer");
        const renderer = new WasmRenderer({
          onStage: (stage) => set({ exportStage: stage }),
          onProgress: (value) => set({ exportProgress: value }),
        });
        blob = await renderer.render(edlForExport, sourceArg);
      }
      set({
        exportUrl: URL.createObjectURL(blob),
        exportStep: doneStep(),
        exportStage: null,
        exportProgress: 1,
      });
    } catch (e) {
      console.error("[export] raw error:", e, "typeof:", typeof e);
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);
      set({
        exportStep: errorStep(message || "Export failed"),
        exportStage: null,
      });
    }
  },

  setVideoEl: (el) => set({ videoEl: el }),

  setCurrentTime: (t) => set({ currentTime: t }),

  seekTo: (seconds) => {
    const el = get().videoEl;
    if (el) {
      el.currentTime = seconds;
      void el.play().catch(() => {});
    }
  },

  reset: () => {
    const s = get();
    if (s.video) URL.revokeObjectURL(s.video.url);
    if (s.exportUrl) URL.revokeObjectURL(s.exportUrl);
    if (s.originalVideo && s.originalVideo !== s.video) URL.revokeObjectURL(s.originalVideo.url);
    if (s.music) URL.revokeObjectURL(s.music.url);
    s.images.forEach((im) => URL.revokeObjectURL(im.url));
    s.broll.forEach((b) => URL.revokeObjectURL(b.url));
    set({
      video: null,
      transcript: null,
      transcribe: idleStep,
      edl: null,
      videoVolume: 1,
      selectedSegmentId: null,
      music: null,
      images: [],
      broll: [],
      filter: "none",
      transition: "cut",
      backgroundMode: "none",
      bgColor: "#22c55e",
      originalVideo: null,
      removeBg: idleStep,
      removeBgProgress: 0,
      projectId: null,
      exportStep: idleStep,
      exportStage: null,
      exportProgress: 0,
      exportUrl: null,
    });
  },
}));
