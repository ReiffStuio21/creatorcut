import Link from "next/link";
import { Scissors, Captions, Wand2, Play, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Scissors,
    title: "Cut by editing text",
    body: "Delete a word in the transcript and the video cuts to match. One click removes every “um.”",
  },
  {
    icon: Captions,
    title: "Auto-captions, burned in",
    body: "Styled captions generated from your speech and baked into the exported MP4.",
  },
  {
    icon: Wand2,
    title: "Looks, music & b-roll",
    body: "Color looks, background music, a logo, and b-roll cutaways — then export, browser or server.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="h-2.5 w-2.5 rounded-full accent-gradient shadow-[0_0_12px_2px_rgba(124,92,255,0.7)]" />
          CreatorCut
        </span>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-foreground/70 transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full accent-gradient px-4 py-2 font-medium text-white glow-accent"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pt-16 pb-24 text-center">
        <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-foreground/70">
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
          AI video editing for beginners
        </span>

        <h1 className="mt-6 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          <span className="text-gradient">Edit your video</span>
          <br />
          by editing its transcript.
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-foreground/55 sm:text-lg">
          Upload a clip, delete the words you don&apos;t want, and CreatorCut cuts the
          video to match. Clean up filler words, auto-caption, and export — without
          ever learning a timeline.
        </p>

        <div className="mt-9 flex items-center gap-3">
          <Link
            href="/signup"
            className="rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white glow-accent transition-transform hover:scale-[1.03]"
          >
            Start editing free
          </Link>
          <Link
            href="/editor"
            className="glass rounded-full px-6 py-3 text-sm font-medium text-foreground/90 transition-colors hover:text-foreground"
          >
            Try the editor →
          </Link>
        </div>

        {/* product visual — the transcript-cut idea, in glass */}
        <div className="mt-16 w-full max-w-4xl">
          <div className="glass rounded-2xl p-3 shadow-[0_40px_120px_-40px_rgba(124,92,255,0.45)]">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              {/* fake preview */}
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black/60">
                <div className="absolute inset-0 accent-gradient opacity-20" />
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <span className="rounded bg-black/60 px-3 py-1 text-sm font-bold uppercase tracking-wide text-white">
                    here is the simple version
                  </span>
                </div>
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full accent-gradient glow-accent">
                  <Play className="h-6 w-6 translate-x-0.5 text-white" aria-hidden />
                </span>
              </div>
              {/* fake transcript */}
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                  Transcript
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground/80">
                  here is the{" "}
                  <span className="rounded bg-white/5 px-0.5">simple</span> version that{" "}
                  <span className="text-amber-400/80 italic line-through decoration-foreground/40">
                    um
                  </span>{" "}
                  actually{" "}
                  <span className="text-foreground/30 line-through decoration-foreground/30">
                    you know
                  </span>{" "}
                  works
                </p>
                <div className="mt-4 flex gap-1.5">
                  <span className="rounded-full accent-gradient px-2.5 py-1 text-[11px] font-medium text-white">
                    Clean up
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-foreground/60">
                    Captions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* features */}
        <div className="mt-20 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient">
                <f.icon className="h-5 w-5 text-white" aria-hidden />
              </span>
              <h2 className="mt-4 font-medium">{f.title}</h2>
              <p className="mt-1.5 text-sm text-foreground/55">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-center text-xs text-foreground/35">
        CreatorCut by LaunchPad IT Solutions · You must own the rights to everything you upload.
      </footer>
    </main>
  );
}
