/**
 * Extract a compact mono MP3 from the source video using the already-bundled
 * FFmpeg.wasm, so the transcription request stays small (well under serverless
 * body limits) regardless of the video's size. Used only when real
 * transcription is enabled.
 */

import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "@/lib/render/ffmpeg";

export async function extractAudioMp3(videoUrl: string): Promise<Uint8Array> {
  const ffmpeg = await getFFmpeg();
  const IN = "ta_in";
  const OUT = "ta_out.mp3";
  try {
    await ffmpeg.writeFile(IN, await fetchFile(videoUrl));
    // mono, 16 kHz, low bitrate — plenty for speech-to-text
    await ffmpeg.exec(["-i", IN, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", OUT]);
    const data = await ffmpeg.readFile(OUT);
    return typeof data === "string" ? new TextEncoder().encode(data) : data;
  } finally {
    await ffmpeg.deleteFile(IN).catch(() => {});
    await ffmpeg.deleteFile(OUT).catch(() => {});
  }
}
