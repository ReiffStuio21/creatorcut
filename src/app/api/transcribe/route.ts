import {
  generateMockTranscript,
  mapDeepgramResponse,
  type DeepgramResponse,
} from "@/lib/transcription/provider";
import { authConfigured, getOptionalUser } from "@/lib/auth/user";

/**
 * POST /api/transcribe
 *
 * Two modes:
 * - Real (Deepgram): when DEEPGRAM_API_KEY (or TRANSCRIPTION_API_KEY) is set and
 *   the request carries audio bytes, forward to Deepgram and return word-level
 *   results. The client sends a small extracted MP3 (see extractAudioMp3).
 * - Mock: otherwise, return a dev mock sized to { durationSeconds } so the editor
 *   works with zero configuration.
 *
 * Because this is a public endpoint that spends real API credits, the Deepgram
 * path is protected by a per-IP rate limit and a payload-size cap.
 */
const DG_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&filler_words=true";

// Cost guards for the public Deepgram path.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~8 MB of compressed audio
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6; // requests per IP per window (per serverless instance)
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(request: Request) {
  const key = process.env.DEEPGRAM_API_KEY ?? process.env.TRANSCRIPTION_API_KEY;
  const contentType = request.headers.get("content-type") ?? "";

  // Real (paid) transcription is for signed-in users. Anonymous visitors fall
  // through to the free mock so the demo still works without spending credits.
  const authed = authConfigured() ? await getOptionalUser() : true;

  if (key && authed && contentType.startsWith("audio/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return new Response("Too many transcription requests. Please wait a minute.", {
        status: 429,
      });
    }

    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > MAX_AUDIO_BYTES) {
      return new Response("Audio too large — use a shorter clip.", { status: 413 });
    }

    const audio = await request.arrayBuffer();
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      return new Response("Audio too large — use a shorter clip.", { status: 413 });
    }

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

  // Mock fallback (anonymous, or no key). Duration from ?d= (audio path) or the
  // JSON body (mock path).
  let durationSeconds = Number(new URL(request.url).searchParams.get("d")) || 0;
  if (!durationSeconds) {
    try {
      const body = await request.json();
      durationSeconds = Number(body?.durationSeconds) || 0;
    } catch {
      // tolerate empty/invalid body
    }
  }
  return Response.json(generateMockTranscript(durationSeconds));
}
