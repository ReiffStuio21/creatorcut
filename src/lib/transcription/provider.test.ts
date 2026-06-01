import { describe, expect, it } from "vitest";
import { generateMockTranscript, mapDeepgramResponse } from "./provider";

describe("generateMockTranscript", () => {
  it("spans the requested duration with word-level timestamps", () => {
    const t = generateMockTranscript(12);
    expect(t.mock).toBe(true);
    expect(t.words.length).toBeGreaterThan(5);
    expect(t.words[0].start).toBe(0);
    expect(t.words[t.words.length - 1].end).toBeLessThanOrEqual(12);
    expect(t.words.some((w) => w.kind === "filler")).toBe(true);
  });
});

describe("mapDeepgramResponse", () => {
  const json = {
    results: {
      channels: [
        {
          alternatives: [
            {
              words: [
                { word: "hey", start: 0, end: 0.4, punctuated_word: "Hey" },
                { word: "um", start: 0.4, end: 0.7 },
                // gap 0.7 → 2.0 (1.3s > 0.7) becomes a silence segment
                { word: "everyone", start: 2.0, end: 2.6, punctuated_word: "everyone." },
              ],
            },
          ],
        },
      ],
    },
  };

  it("maps words, tags fillers, and inserts silence for gaps", () => {
    const t = mapDeepgramResponse(json);
    expect(t.mock).toBe(false);
    expect(t.provider).toBe("deepgram");
    expect(t.words.map((w) => w.text)).toEqual(["Hey", "um", "—", "everyone."]);
    expect(t.words[1].kind).toBe("filler");
    expect(t.words[2].kind).toBe("silence");
    expect(t.words[3].kind).toBeUndefined();
  });

  it("handles an empty/malformed response", () => {
    expect(mapDeepgramResponse({}).words).toEqual([]);
  });
});
