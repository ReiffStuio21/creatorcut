/**
 * Transcription provider seam (PLAN.md §3, §4c). The MVP ships a dev mock so the
 * whole transcript-editing experience works with zero external setup. To wire a
 * real provider (Deepgram / AssemblyAI / a Whisper-based API), implement
 * `transcribeWithProvider` to forward the audio and map the response into the
 * `Transcript` shape — the rest of the app is provider-agnostic.
 */

export interface TranscriptWord {
  /** seconds in the SOURCE video */
  start: number;
  end: number;
  text: string;
  /** auto-tagged non-speech the editor can one-click remove (Phase 3) */
  kind?: "filler" | "silence";
}

export interface Transcript {
  words: TranscriptWord[];
  provider: string;
  /** true when produced by the dev mock (no real transcription key set) */
  mock: boolean;
}

const FILLERS = ["um", "uh", "like", "you know", "so"];

// A neutral talking-head script the mock cycles through. Real speech, real
// timestamps later — for now this proves the editing flow end to end.
const SCRIPT = (
  "hey everyone and welcome back to the channel today I want to walk you " +
  "through something that took me way too long to figure out when I first " +
  "started so let us just get right into it the first thing you need to know " +
  "is that consistency matters more than perfection I learned that the hard " +
  "way after months of overthinking every single detail so here is the simple " +
  "version that actually works for real people with busy lives thanks for " +
  "watching and I will see you in the next one"
).split(" ");

/**
 * Deterministic mock: lays words across the clip's real duration, sprinkling in
 * filler words and a couple of silence gaps so Phase 3's "clean up" has
 * something to detect. No randomness, so output is stable for tests/snapshots.
 */
export function generateMockTranscript(durationSeconds: number): Transcript {
  const duration = durationSeconds > 0 ? durationSeconds : 30;
  const words: TranscriptWord[] = [];
  let t = 0;
  let i = 0;

  while (t < duration) {
    // Every 9th token is a filler; every 13th leaves a short silence gap.
    const isFiller = i > 0 && i % 9 === 0;
    const leavesGap = i > 0 && i % 13 === 0;

    const text = isFiller ? FILLERS[i % FILLERS.length] : SCRIPT[i % SCRIPT.length];
    const len = isFiller ? 0.4 : 0.32 + (text.length % 5) * 0.04;
    const end = Math.min(t + len, duration);

    words.push({
      start: round(t),
      end: round(end),
      text,
      ...(isFiller ? { kind: "filler" as const } : {}),
    });

    t = end;
    if (leavesGap && t < duration) {
      const gapEnd = Math.min(t + 0.8, duration);
      words.push({ start: round(t), end: round(gapEnd), text: "—", kind: "silence" });
      t = gapEnd;
    }
    i++;
  }

  return { words, provider: "mock", mock: true };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
