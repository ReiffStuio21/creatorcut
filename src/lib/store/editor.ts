import { create } from "zustand";

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
  loadFile: (file: File) => void;
  setMetadata: (meta: { duration: number; width: number; height: number }) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  video: null,

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
    });
  },

  setMetadata: (meta) =>
    set((s) => (s.video ? { video: { ...s.video, ...meta } } : s)),

  reset: () => {
    const prev = get().video;
    if (prev) URL.revokeObjectURL(prev.url);
    set({ video: null });
  },
}));
