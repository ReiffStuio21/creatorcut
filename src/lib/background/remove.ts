/**
 * On-device background removal (Phase: backgrounds). Uses MediaPipe Selfie
 * Segmentation (runs in the browser, no API/cost) to matte the person, composites
 * them onto a new background (solid color or blurred original), and records the
 * result — with the original audio — to a webm Blob. The baked clip then becomes
 * the editor's source, so the cut/captions/export all work on it.
 */

import { FilesetResolver, ImageSegmenter, type MPMask } from "@mediapipe/tasks-vision";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

let segmenterPromise: Promise<ImageSegmenter> | null = null;
async function create(delegate: "GPU" | "CPU"): Promise<ImageSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}
async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    // GPU is fastest; fall back to CPU where WebGL isn't available.
    segmenterPromise = create("GPU")
      .catch(() => create("CPU"))
      .catch((e) => {
        segmenterPromise = null;
        throw e;
      });
  }
  return segmenterPromise;
}

export type BackgroundMode = { type: "color"; color: string } | { type: "blur" };

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback: (cb: (now: number) => void) => number;
};

function pickMime(): string | undefined {
  for (const t of ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export async function removeBackground(
  videoUrl: string,
  mode: BackgroundMode,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const segmenter = await getSegmenter();

  const video = document.createElement("video") as VideoWithRVFC;
  video.src = videoUrl;
  video.playsInline = true;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not load the video for processing."));
  });
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 1280;
  const duration = video.duration || 0;

  const make = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  const canvas = make();
  const ctx = canvas.getContext("2d")!;
  const tmp = make();
  const tctx = tmp.getContext("2d")!;
  const maskC = make();
  const mctx = maskC.getContext("2d")!;
  const maskImage = mctx.createImageData(w, h);

  // route the original audio into the recording (and keep it off the speakers)
  const ac = new AudioContext();
  const srcNode = ac.createMediaElementSource(video);
  const dest = ac.createMediaStreamDestination();
  srcNode.connect(dest);

  const stream = new MediaStream([
    ...canvas.captureStream(30).getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  const recorder = new MediaRecorder(stream, { mimeType: pickMime() });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const recorded = new Promise<Blob>((res) => {
    recorder.onstop = () => res(new Blob(chunks, { type: chunks[0]?.type ?? "video/webm" }));
  });

  const drawFrame = (now: number) => {
    const result = segmenter.segmentForVideo(video, now);
    const mask = result.confidenceMasks?.[0] as MPMask | undefined;

    if (mode.type === "color") {
      ctx.fillStyle = mode.color;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.filter = "blur(14px)";
      ctx.drawImage(video, 0, 0, w, h);
      ctx.filter = "none";
    }

    if (mask) {
      const conf = mask.getAsFloat32Array();
      const data = maskImage.data;
      for (let i = 0; i < conf.length; i++) data[i * 4 + 3] = conf[i] > 0.5 ? 255 : 0;
      mctx.putImageData(maskImage, 0, 0);
      // person = video masked to the foreground, drawn over the new background
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(video, 0, 0, w, h);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(maskC, 0, 0);
      tctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tmp, 0, 0);
      mask.close();
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }
    result.close();
    if (duration) onProgress?.(Math.min(1, video.currentTime / duration));
  };

  let stopped = false;
  const loop = (now: number) => {
    if (stopped) return;
    drawFrame(now);
    video.requestVideoFrameCallback(loop);
  };

  recorder.start();
  await ac.resume();
  await video.play();
  video.requestVideoFrameCallback(loop);

  await new Promise<void>((res) => {
    video.onended = () => res();
  });
  stopped = true;
  recorder.stop();
  const blob = await recorded;
  ac.close().catch(() => {});
  return blob;
}
