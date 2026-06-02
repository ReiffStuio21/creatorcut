"use client";

import { Loader2, Mic, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

/** AI text-to-speech voiceover (OpenAI), mixed into the export audio. */
export function VoiceoverPanel() {
  const video = useEditorStore((s) => s.video);
  const text = useEditorStore((s) => s.ttsText);
  const setText = useEditorStore((s) => s.setTtsText);
  const voice = useEditorStore((s) => s.ttsVoice);
  const setVoice = useEditorStore((s) => s.setTtsVoice);
  const step = useEditorStore((s) => s.tts);
  const generate = useEditorStore((s) => s.generateVoiceover);
  const voiceover = useEditorStore((s) => s.voiceover);
  const removeVoiceover = useEditorStore((s) => s.removeVoiceover);

  if (!video) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-foreground/40">
        Upload a video to add a voiceover.
      </div>
    );
  }

  const running = step.status === "running";

  return (
    <div className="mt-2 flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Type what the AI voice should say…"
        className="w-full resize-none rounded-lg border border-foreground/15 bg-transparent px-2.5 py-2 text-xs outline-none focus:border-foreground/40"
      />
      <div className="flex items-center gap-2">
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="rounded-md border border-foreground/15 bg-panel px-2 py-1.5 text-xs"
        >
          {VOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={running || !text.trim()}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md accent-gradient px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Mic className="h-3.5 w-3.5" aria-hidden />
          )}
          {running ? "Generating…" : voiceover ? "Regenerate" : "Generate"}
        </button>
      </div>

      {step.status === "error" && (
        <p className="text-[11px] text-red-500">{step.error}</p>
      )}

      {voiceover && (
        <div className="flex items-center gap-2 rounded-lg border border-foreground/10 p-2">
          <Mic className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
          <audio src={voiceover.url} controls className="h-7 min-w-0 flex-1" />
          <button
            type="button"
            onClick={removeVoiceover}
            className="rounded p-0.5 text-foreground/40 hover:text-foreground"
            aria-label="Remove voiceover"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
      <p className="text-[11px] text-foreground/40">
        Mixed into the export audio. Needs the API key set up.
      </p>
    </div>
  );
}
