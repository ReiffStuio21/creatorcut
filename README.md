# CreatorCut

> **Edit your video by editing its transcript.** Beginner-first AI video editor — upload a clip, delete the words you don't want, clean up filler words, auto-caption, and export an MP4. No timeline required.

**Live demo:** _(coming at Phase 8 — deploy to Vercel)_

## Why it's interesting (the architecture)

Four ideas make this real engineering, not glued-together API calls (see [PLAN.md](PLAN.md) §4):

1. **One edit model (the EDL).** An [Edit Decision List](src/lib/edl/types.ts) is the single source of truth. The preview player and every renderer read the *same* EDL, so an edit produces identical output in the browser or on a server. Its operations are [pure functions](src/lib/edl/operations.ts) with a real [test suite](src/lib/edl/operations.test.ts).
2. **Swappable renderers.** One [`Renderer` interface](src/lib/render/renderer.ts), two backends: `WasmRenderer` (FFmpeg.wasm, MVP) and `ServerRenderer` (Phase 2). Swap the implementation, not the app.
3. **An explicit AI pipeline.** transcribe → detect fillers/silence → caption, each step retryable and re-runnable independently.
4. **A cost meter.** Tracks estimated API spend per project.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase (Auth/Postgres/Storage) · Zustand · FFmpeg.wasm (Phase 6) · Anthropic SDK.

## Develop

```sh
cp .env.local.example .env.local   # fill in Supabase + API keys (optional for first run)
npm install
npm run dev                        # http://localhost:3000
npm test                           # EDL unit tests
npm run typecheck
```

The app runs without Supabase configured (landing + editor shell are viewable); auth gating activates once env vars are set.

## Status

Phase 0 (scaffold) complete. Build order and full scope live in **[PLAN.md](PLAN.md)** — the single source of truth.
