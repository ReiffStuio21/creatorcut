import { generateMockTranscript } from "@/lib/transcription/provider";

/**
 * POST /api/transcribe
 * Body: { durationSeconds: number }
 * Returns a Transcript (word-level timestamps).
 *
 * MVP returns a dev mock so the editing flow works without external setup.
 * To wire a real provider: accept the audio (multipart or a Supabase Storage
 * URL), forward it to the transcription API using TRANSCRIPTION_API_KEY, and map
 * the response into the Transcript shape. Keep `mock: false` for real results.
 */
export async function POST(request: Request) {
  let durationSeconds = 0;
  try {
    const body = await request.json();
    durationSeconds = Number(body?.durationSeconds) || 0;
  } catch {
    // tolerate empty/invalid body → mock falls back to a default length
  }

  // TODO(real-provider): when TRANSCRIPTION_API_KEY is set, call the chosen
  // speech-to-text API here and return its word-level result with mock:false.
  const transcript = generateMockTranscript(durationSeconds);

  return Response.json(transcript);
}
