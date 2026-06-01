import {
  generateMockTranscript,
  mapDeepgramResponse,
  type DeepgramResponse,
} from "@/lib/transcription/provider";

/**
 * POST /api/transcribe
 *
 * Two modes:
 * - Real (Deepgram): when DEEPGRAM_API_KEY (or TRANSCRIPTION_API_KEY) is set and
 *   the request carries audio bytes, forward to Deepgram and return word-level
 *   results. The client sends a small extracted MP3 (see extractAudioMp3).
 * - Mock: otherwise, return a dev mock sized to { durationSeconds } so the editor
 *   works with zero configuration.
 */
const DG_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&filler_words=true";

export async function POST(request: Request) {
  const key = process.env.DEEPGRAM_API_KEY ?? process.env.TRANSCRIPTION_API_KEY;
  const contentType = request.headers.get("content-type") ?? "";

  if (key && contentType.startsWith("audio/")) {
    const audio = await request.arrayBuffer();
    const dg = await fetch(DG_URL, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
      body: audio,
    });
    if (!dg.ok) {
      const detail = await dg.text().catch(() => "");
      return new Response(`Transcription failed (${dg.status}). ${detail}`.trim(), {
        status: 502,
      });
    }
    const json = (await dg.json()) as DeepgramResponse;
    return Response.json(mapDeepgramResponse(json));
  }

  // Mock fallback (JSON body with durationSeconds).
  let durationSeconds = 0;
  try {
    const body = await request.json();
    durationSeconds = Number(body?.durationSeconds) || 0;
  } catch {
    // tolerate empty/invalid body
  }
  return Response.json(generateMockTranscript(durationSeconds));
}
