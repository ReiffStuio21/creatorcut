import Link from "next/link";

const STEPS = [
  { n: "1", title: "Upload", body: "Drag in a talking-head clip. No timeline, no codecs, no settings." },
  { n: "2", title: "Edit the transcript", body: "Delete a sentence of text and the matching video disappears. One click removes every “um.”" },
  { n: "3", title: "Caption & export", body: "Auto-captions burn in. Pick 9:16, 1:1, or 16:9 and download an MP4." },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">CreatorCut</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-foreground/70 hover:text-foreground">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-4 rounded-full border border-foreground/15 px-3 py-1 text-xs font-medium text-foreground/60">
          AI video editing for beginners
        </p>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          Edit your video by editing its transcript.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base text-foreground/60 sm:text-lg">
          Upload a clip, delete the words you don&apos;t want, and CreatorCut cuts the
          video to match. Clean up filler words, auto-caption, and export — without
          ever learning a timeline.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
          >
            Start editing free
          </Link>
          <Link
            href="/editor"
            className="rounded-full border border-foreground/15 px-6 py-3 text-sm font-medium hover:bg-foreground/5"
          >
            See the editor
          </Link>
        </div>

        <div className="mt-20 grid w-full gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-foreground/10 p-6 text-left"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold">
                {s.n}
              </div>
              <h2 className="mt-4 font-medium">{s.title}</h2>
              <p className="mt-1 text-sm text-foreground/60">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-xs text-foreground/40">
        CreatorCut by LaunchPad IT Solutions · You must own the rights to everything you upload.
      </footer>
    </main>
  );
}
