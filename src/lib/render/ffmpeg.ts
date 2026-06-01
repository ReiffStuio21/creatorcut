/**
 * Lazy FFmpeg.wasm singleton. The core (~30 MB) is fetched from a CDN on first
 * use and cached for the session. Uses the single-thread core, which does NOT
 * require cross-origin isolation (COOP/COEP) — so it works on a plain Vercel
 * deploy without special headers.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const CORE_VERSION = "0.12.10";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      instance = ffmpeg;
      return ffmpeg;
    })().catch((e) => {
      console.error("[ffmpeg] load failed:", e);
      // allow a later retry if the CDN fetch/load fails
      loadPromise = null;
      throw e;
    });
  }
  return loadPromise;
}
