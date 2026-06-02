/**
 * POST /api/tts — generate a voiceover from text (OpenAI TTS).
 * Body: { text, voice }. Returns audio/mpeg. Needs OPENAI_API_KEY; rate-limited
 * because it spends real credits.
 */
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const MAX_CHARS = 2000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
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
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return new Response("Voiceover isn't configured yet (set OPENAI_API_KEY).", {
      status: 501,
    });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return new Response("Too many voiceover requests. Please wait a minute.", { status: 429 });
  }

  let text = "";
  let voice = "alloy";
  try {
    const body = await request.json();
    text = String(body?.text ?? "").trim();
    if (VOICES.includes(body?.voice)) voice = body.voice;
  } catch {
    // fall through to validation
  }
  if (!text) return new Response("No text provided.", { status: 400 });
  if (text.length > MAX_CHARS) {
    return new Response(`Text too long (max ${MAX_CHARS} characters).`, { status: 400 });
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "mp3" }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return new Response(`Voiceover failed (${res.status}). ${detail}`.slice(0, 300), {
      status: 502,
    });
  }
  const audio = await res.arrayBuffer();
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
}
