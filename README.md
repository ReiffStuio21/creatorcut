# CreatorCut

> **Edit your video by editing its transcript.** A beginner-first AI video editor: upload a clip, delete the words you don't want, clean up filler words, auto-caption, add music + a logo, pick a look, and export an MP4 — without ever learning a timeline.

**Live demo:** **[creatorcut-sepia.vercel.app](https://creatorcut-sepia.vercel.app)** · **Demo:** _add a 30–60s GIF here_

The app runs with **zero configuration** — transcription falls back to a built-in dev mock and auth is a no-op until you add Supabase — so a fresh deploy is a working demo immediately.

---

## What it does

1. **Upload** a talking-head clip (drag & drop).
2. **Transcribe** — word-level timestamps.
3. **Edit the transcript = edit the video.** Click a word to cut it; one click removes every "um" and silence.
4. **Captions** — styled, synced, and burned into the export.
5. **Your media** — background music (mixed under the speech) and a logo/image overlay.
6. **Looks** — six one-click color filters.
7. **Export** an MP4 (9:16 / 1:1 / 16:9) with the cut, captions, music, logo, and look all baked in.

---

## Why it's interesting (the architecture)

Four ideas make this real engineering rather than glued-together API calls:

```
┌──────────────────────────────────────────────┐
│  Browser (Next.js client)                      │
│   • Upload dropzone                            │
│   • Transcript editor (the core UI)            │
│   • Video preview player  ─┐                   │
│   • Caption styling panel  ├─ all read the EDL │
│   • Media tray (music/img) ┘                   │
│   • WasmRenderer (FFmpeg.wasm)                 │
│   • Cost meter                                 │
└───────────────┬────────────────────────────────┘
                │  (API routes)
┌───────────────┼────────────────────────────────┐
│  Next.js API / server                           │
│   AI pipeline: transcribe → detect → caption    │
│   • /api/transcribe  (provider seam + dev mock) │
└─────────────────────────────────────────────────┘
```

1. **One edit model — the EDL.** An [Edit Decision List](src/lib/edl/types.ts) is the single source of truth: which transcript segments are kept, the captions, the tracks, the look. The preview player and *every* renderer backend read the **same** EDL, so an edit produces identical output in the browser or on a server. Its operations are [pure functions](src/lib/edl/operations.ts) with a real [test suite](src/lib/edl/operations.test.ts).
2. **Swappable renderers.** One [`Renderer` interface](src/lib/render/renderer.ts); the MVP ships [`WasmRenderer`](src/lib/render/wasm-renderer.ts) (FFmpeg.wasm, in-browser) with `ServerRenderer` as the documented scale path — swap the implementation, not the app.
3. **An explicit AI pipeline.** transcribe → detect fillers/silence → caption is modeled as a [state machine](src/lib/pipeline/types.ts) (idle → running → done → error, retryable), not scattered fetch calls.
4. **A cost meter.** Per-project estimate of API/render spend — operational awareness most demos never show.

## Verified in the *pixels*, not just the code

Most portfolio projects have no tests. CreatorCut has **25 unit tests** on the pure EDL/caption/export logic **and four real-browser end-to-end checks** (Playwright + the app's own FFmpeg) that assert the exported **pixels** are correct:

| Check | What it proves | Command |
|---|---|---|
| Export | Audio & silent clips export a valid MP4 | `npm run test:e2e` |
| Captions | Burned-in captions appear (A/B: ON ≈ 15k white px, OFF = 0) | `npm run test:e2e:captions` |
| Media | A logo lands in the frame + music adds an audio stream | `npm run test:e2e:media` |
| Look | "Mono" export is 100% grayscale | `npm run test:e2e:filter` |

---

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Zustand · FFmpeg.wasm (libx264 + libass) · Anthropic SDK · Supabase (optional, for future auth/persistence) · Vitest + Playwright.

## Run locally

```sh
cp .env.local.example .env.local   # optional — app runs without it
npm install
npm run dev                        # http://localhost:3000  → /editor
```

```sh
npm test            # 25 unit tests
npm run typecheck   # tsc --noEmit
npm run lint
# real-browser checks (need: npm run dev running + `npx playwright install chromium` + a sample clip)
npm run test:e2e
```

## Deploy to Vercel

1. Push this repo to GitHub (`gh repo create` or your preferred flow).
2. Import it at [vercel.com/new](https://vercel.com/new) — Vercel auto-detects Next.js; no build config needed.
3. **No environment variables are required** for the demo. The FFmpeg core is fetched from a CDN at runtime, single-threaded (no COOP/COEP headers needed).
4. Deploy → you get a working live editor with mock transcription.

### Environment variables (optional, for later)

See [`.env.local.example`](.env.local.example). When you wire real services:

| Var | Enables |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth + saved projects (proxy gating activates automatically) |
| `ANTHROPIC_API_KEY` | AI editing suggestions / scripts |
| `TRANSCRIPTION_API_KEY` | Real speech-to-text (replaces the dev mock) |

---

## Status & roadmap

**Done (verified live):** transcript-cut editing · timeline (split / cut / volume) · filler/silence cleanup · captions (preview + burn-in) · music + logo overlays · **b-roll cutaways** · color looks · **fade transitions** · **on-device background removal** (color / blur / image) · **auto-enhance** · **AI noise removal** · **AI voiceover** (OpenAI TTS) · MP4 export · **server-side rendering** with full parity (ffmpeg worker on Fly, for long clips) · **real Deepgram transcription** (rate-limited) · **Supabase auth + saved projects** (DB + Storage, RLS) · responsive dark-studio UI.

**Next:** persist b-roll with projects · stock media · a render job queue for very long clips.

The full build plan and decisions live in **[PLAN.md](PLAN.md)** — the single source of truth.

---

_You must own the rights to everything you upload. CreatorCut is not affiliated with CapCut, Movavi, or Descript._
