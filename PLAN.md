# CreatorCut — Build Plan & Claude Code Spec

**Author:** Shareiff Robinson, LaunchPad IT Solutions
**Purpose:** A beginner-first web app that uses AI to do the editing work most people can't do themselves.
**Goals (priority order):** (1) edit my own videos, (2) a strong portfolio piece, (3) share with other creators.
**Status:** v1 spec (MVP). Broader product surface (wizard, templates, billing) is documented in §11 as the post-MVP roadmap.

> This document is the single source of truth. Paste relevant sections to Claude Code one slice at a time. Keep it updated.

---

## 0. How this plan was decided (read first)

This plan merges two earlier strategy docs:

- **Doc A — "AI Beginner Video Editor"** (broad): a wizard-driven, multi-user-type promo builder with scene cards, templates, brand kits, and billing.
- **Doc B — "AI Video Editor for Beginners"** (narrow): a Descript-style **transcript-first** editor with a disciplined, shippable architecture (EDL, swappable renderer, AI pipeline, cost meter).

**Decision:** Build on the **Doc B spine** (transcript-first MVP + ship discipline + clean architecture) and treat **Doc A's data model and feature set as the documented roadmap** (§11). Only ONE core editing experience ships first — the transcript editor — because a scene-card promo builder and a transcript editor are different first screens, and shipping one well beats half-building both.

### The portfolio principle that governs every decision

A deployed, documented video tool is well above the usual todo-app portfolio — but **only if it ships**. A half-finished editor is a *worse* portfolio piece than a small finished one. The rule for the whole project: **scope something you will actually finish, deploy it with a live link, write up the architecture.** Every "wouldn't it be cool if" is measured against "does this help me ship?" If not, it goes to the roadmap.

---

## 1. What the app does (MVP scope)

**Core loop a beginner experiences:**

1. Upload a video (drag and drop).
2. App auto-transcribes the audio into text (word-level timestamps).
3. App auto-detects silences, long pauses, and filler words ("um", "uh", "like").
4. User trims by **editing the transcript** — delete a line of text, the matching video cuts there. One-click "remove all filler words".
5. App auto-generates **captions** burned onto the video.
6. User can drop in **their own music, images, and B-roll** as simple overlays/background tracks (no complex compositing).
7. User picks an aspect ratio (9:16, 1:1, 16:9) and **exports an MP4**.

**The differentiator:** edit your video by editing its transcript. Beginner-friendly, genuinely useful, and actually buildable.

**Explicitly OUT of scope for v1** (this is what keeps it finishable):
- Multi-track timeline with keyframes
- AI background removal / green screen
- Blend modes, large effects libraries, advanced color grading
- Real-time collaboration / cloud projects
- Mobile native apps
- The wizard / scene-card promo builder (that's the roadmap, §11)

---

## 2. Feature list — keep vs cut

| Feature | In v1? | Why |
|---|---|---|
| Drag-and-drop upload | ✅ | Table stakes |
| Auto-transcription | ✅ | Powers everything else |
| Transcript-based trimming | ✅ | **The differentiator** |
| Filler-word / silence removal | ✅ | Real beginner pain, easy with timestamps |
| Auto-captions (burned in) | ✅ | Highest-value AI feature |
| Add own music / image / b-roll | ✅ | Simple tracks, not compositing |
| Aspect-ratio presets + MP4 export | ✅ | Required to be useful |
| 3–5 basic filters (LUTs) | ✅ | Cheap, high perceived value |
| 3 transitions (cut/fade/dissolve) | ✅ | Cheap |
| Background noise removal | 🟡 stretch | API-based, add if budget allows |
| AI background removal | ❌ Phase 2 | Heavy compute |
| Full timeline / multi-track | ❌ Phase 2 | Scope killer |
| Wizard / scene-card promo builder | ❌ Roadmap | Different core; §11 |
| Templates / brand kit / billing | ❌ Roadmap | §11 |

---

## 3. Tech stack

Boring, well-supported tools so Claude Code can scaffold fast and the hard video parts lean on existing libraries.

- **Framework:** Next.js 16 (App Router, Turbopack) + TypeScript. ⚠️ Next 16 has breaking changes vs training data — read `node_modules/next/dist/docs/` before writing route/proxy code. (`middleware.ts` is renamed to `proxy.ts`.)
- **Styling:** Tailwind v4 + shadcn/ui-style primitives.
- **Editor state:** Zustand.
- **Auth / DB / Storage:** Supabase (Auth, Postgres + RLS, Storage). Clients in `src/lib/supabase/`. Same proven Next-16 pattern as the Tyanna app.
- **Video preview:** HTML5 `<video>` + lightweight custom player reading the EDL. Remotion is an option later for programmatic preview.
- **Transcription:** external speech-to-text API (Whisper-based) returning **word-level timestamps**. Rent it; don't build models.
- **Captions / TTS / noise removal:** external AI APIs.
- **AI suggestions / scripts:** Anthropic SDK (`@anthropic-ai/sdk`), latest Claude models, with prompt caching.
- **Rendering/export — the critical decision:** one `Renderer` interface, two implementations:
  - **MVP — `WasmRenderer`:** FFmpeg.wasm in the browser for short clips (< ~3 min, 1080p). Zero server cost, slow/memory-limited, good enough to prove the idea. *(FFmpeg.wasm deps added at Phase 6, not before.)*
  - **Phase 2 — `ServerRenderer`:** real ffmpeg on a worker for longer clips / sharing. Build the seam now even if the server side is a stub.

---

## 4. Architecture (MVP) — also the portfolio writeup

Four ideas make this read as *engineering*, not glue: a single edit model, a swappable renderer, an explicit AI pipeline, and a cost meter.

```
┌──────────────────────────────────────────────┐
│  Browser (Next.js client)                      │
│   • Upload dropzone                            │
│   • Transcript editor (the core UI)            │
│   • Video preview player  ─┐                   │
│   • Caption styling panel  ├─ all read the EDL │
│   • Media tray (music/img) ┘                   │
│   • WasmRenderer (short clips)                 │
│   • Cost meter panel                           │
└───────────────┬────────────────────────────────┘
                │  (API routes)
┌───────────────┼────────────────────────────────┐
│  Next.js API / server                           │
│   AI pipeline: transcribe → detect → caption    │
│   • /api/transcribe → speech-to-text API        │
│   • /api/captions   → caption generation        │
│   • /api/suggest    → Claude editing suggestions │
│   • /api/noise      → (stretch) denoise API     │
│   • /api/render     → (Phase 2) ServerRenderer   │
└─────────────────────────────────────────────────┘
```

### 4a. The EDL is the centerpiece — design it first

The **edit decision list (EDL)** is the single source of truth: which transcript segments are kept, in what order, with what overlays and captions. The preview player and the renderer read the **same** EDL, so the same edit produces identical output in browser or server. Because the EDL is plain data and the operations on it are pure functions, it's trivially unit-testable — `applyFillerRemoval(edl)`, `toKeptSegments(edl)`, etc. That's a real test suite most portfolios lack.

EDL shape lives in code at [`src/lib/edl/types.ts`](src/lib/edl/types.ts); operations at [`src/lib/edl/operations.ts`](src/lib/edl/operations.ts).

### 4b. Rendering behind one interface

```ts
interface Renderer {
  render(edl: EDL, source: VideoSource): Promise<Blob>;   // returns the MP4
  estimateCost(edl: EDL): CostEstimate;                    // feeds the cost meter
}
class WasmRenderer implements Renderer { /* FFmpeg.wasm, MVP, short clips */ }
class ServerRenderer implements Renderer { /* real ffmpeg worker, Phase 2 stub */ }
```

Interface seam lives at [`src/lib/render/renderer.ts`](src/lib/render/renderer.ts). When browser rendering chokes on a 5-min clip, swap the implementation, not the app.

### 4c. The AI work is a pipeline, not scattered buttons

transcribe → filler/silence detection → caption generation is a **sequence with intermediate state**. Each step: `idle → running → done → error`, with retry, and re-runnable independently (regenerate captions without re-transcribing — saves API spend). Pipeline state machine lives at [`src/lib/pipeline/`](src/lib/pipeline/).

### 4d. Cost meter

Every transcription/caption call costs money. A small panel tracks estimated API spend per project (fed by `estimateCost`). Useful for you, and operational cost-awareness is something almost no demo project shows.

---

## 5. Build plan — the order to give Claude Code

Thin vertical slices. Each phase ends with something you can click. **Do not move on until the current slice works end to end.**

- **Phase 0 — Scaffold** ✅ *(done)*: Next.js + TS + Tailwind, three-panel shell, Supabase clients wired, EDL types + Renderer seam stubbed, env example, PLAN.md.
- **Phase 1 — Upload & play** (1 day): drag-and-drop upload → browser memory → `<video>`; show duration/resolution. *Checkpoint: upload a clip and play it.*
- **Phase 2 — Transcription (pipeline step 1)** (1–2 days): pipeline scaffold; send audio → word-level timestamps; render editable transcript; click word → seek; failed call retryable without re-upload.
- **Phase 3 — Transcript editing = video editing** (3–4 days, the heart): EDL model + pure functions + **unit tests first**; strike a segment → `kept:false`; preview skips un-kept; auto-detect fillers/silence + one-click "Clean up". *Checkpoint: delete a sentence → playback skips it; EDL tests pass.*
- **Phase 4 — Captions** (2 days): caption cues from timestamps; overlay with 2–3 style presets; synced in preview.
- **Phase 5 — User media** (2–3 days): music (bg track + volume), image/logo (overlay + position + start/end), extra video (EDL segment).
- **Phase 6 — Export via `Renderer`** (3–5 days, expect pain): add FFmpeg.wasm deps; implement `WasmRenderer`; EDL → FFmpeg filtergraph (cut, concat, burn captions, mix music, overlay images, aspect ratio); 9:16/1:1/16:9 presets; progress bar; wire `estimateCost`. Test 30s → 2min; when it stalls, that's the `ServerRenderer` signal.
- **Phase 7 — Polish**: 3–5 LUT filters, 3 transitions, empty/loading/error states, 3-step onboarding.
- **Phase 8 — Ship** (½–1 day, non-negotiable): deploy to Vercel, live URL atop the README, README around the four architecture ideas + diagram, 30–60s demo GIF. *Checkpoint: a stranger opens the link, edits a clip, downloads an MP4.*

---

## 6. Driving Claude Code

- One vertical slice per session; don't ask for the whole app at once.
- After each slice: "What did you just build, and how do I test it works?"
- Write the data model/types **before** the UI for any complex feature.
- When something breaks, paste the actual error, not a description.
- Keep PLAN.md the source of truth.

---

## 7. Cost & risk reality

- **Transcription / caption / denoise APIs:** roughly per-minute or per-request. Light personal use is cheap; opening to others adds up.
- **Browser rendering (MVP):** free but limited. **Server rendering (Phase 2):** real CPU/GPU + storage + bandwidth money.
- **Honest bottom line:** for editing *just your own* videos, CapCut free is cheaper in dollars. The value here is the **portfolio piece** and the **tool you built end to end.** Keep your own usage cheap; let the cost meter keep you honest.

**Biggest risks, ranked:** (1) not shipping — treat Phase 8 as non-negotiable; (2) export/rendering stalls — start with tiny clips, keep the EDL clean; (3) scope creep — the transcript-first scope is the defense; (4) treating AI features as things to *build* — they're APIs; (5) browser memory — cap upload length/size in v1; (6) confusing the beginner — fewer, clearer choices win.

**Sharing with creators (when it happens):** Supabase auth (never hand-rolled), hard caps on upload size/length, rate-limit AI endpoints per user, and a clear "you must own the rights to everything you upload" notice (consider bundling royalty-free tracks). Settle copyright before it's public.

---

## 8. Definition of done (MVP)

A non-technical person opens a **live URL**, uploads a 2-minute talking-head clip, clicks "clean up filler words," sees auto-captions appear, drops in a background song, picks 9:16, and downloads a finished MP4 — without ever touching a timeline. The repo has a README built around the four architecture ideas, a passing test suite on the EDL functions, and a demo GIF.

---

## 9. MVP data model (Supabase)

Minimal tables to support the transcript-first MVP. (Full Doc A schema is the roadmap, §11.)

- **profiles** — `id` (→ auth.users), `full_name`, `avatar_url`, `plan`, timestamps.
- **projects** — `id`, `user_id`, `title`, `aspect_ratio`, `status`, `source_asset_id`, `thumbnail_url`, timestamps.
- **assets** — `id`, `project_id`, `user_id`, `asset_type` (video/image/audio/logo), `file_name`, `file_url`, `file_size`, `mime_type`, `duration`, `width`, `height`, `created_at`.
- **edls** — `id`, `project_id`, `version_number`, `edl_json` (the EDL), `created_at`, `updated_at`.
- **captions** — `id`, `project_id`, `start_time`, `end_time`, `text`, `style_json`, `created_at`.
- **exports** — `id`, `project_id`, `user_id`, `status`, `export_url`, `resolution`, `aspect_ratio`, `duration`, `file_size`, `created_at`.
- **ai_generations** — `id`, `project_id`, `user_id`, `generation_type`, `prompt`, `response_json`, `cost_estimate`, `created_at`.

All tables RLS-protected to `auth.uid() = user_id`. Migrations live in `supabase/migrations/`, run in order.

---

## 10. Project layout

```
src/
  app/
    (auth)/            # login, signup, forgot-password (public)
    (app)/             # protected: dashboard, editor
    auth/callback/     # Supabase email/OAuth callback
    api/               # transcribe, captions, suggest, (noise), (render)
    layout.tsx, page.tsx, globals.css
  components/
    ui/                # primitives (button, input, card, ...)
    editor/            # transcript editor, preview player, media tray, cost meter
  lib/
    supabase/          # client.ts, server.ts, middleware.ts, types.gen.ts
    edl/               # types.ts (EDL model), operations.ts (pure fns) + tests
    render/            # renderer.ts (interface), wasm-renderer.ts, server-renderer.ts
    pipeline/          # AI pipeline state machine
    utils.ts           # cn()
  proxy.ts             # Next 16 middleware → updateSession
supabase/
  migrations/          # SQL migrations, in order
```

---

## 11. Roadmap (post-MVP — from Doc A, deliberately deferred)

Documented so the architecture leaves room, but **not built until the MVP ships and proves out.**

- **Server-side rendering** (`ServerRenderer`) for long clips; user accounts already in place via Supabase.
- **AI extras:** silence/filler already in MVP; add B-roll suggestions, AI thumbnails, TTS, voiceover recording, AI script generator, social caption generator, long-form → short-form repurposing.
- **Project wizard ("AI editing by purpose"):** the Doc A flow — choose video type / platform / aspect / duration / tone → AI assembles a first-draft plan. A *second* core mode alongside the transcript editor.
- **Scene-card editor & simple timeline:** Doc A's assembly UI for montage-style promos.
- **Templates** (10 to start: business promo, testimonial, product showcase, church announcement, event recap, educational lesson, YouTube intro, Reel, music promo, nonprofit impact).
- **Brand kit:** logo, colors, fonts, intro/outro text, website, social handle, default CTA.
- **Billing (Stripe):** Free (3 projects, 720p, watermark, limited AI credits) / Creator ($15–25, unlimited, 1080p, no watermark) / Business ($39–79, teams, priority render) / Agency ($99+, client folders, white-label).
- **Full Doc A data model:** `timelines`, `scenes`, `brand_kits`, `templates` tables layer on top of the MVP schema.
- **Background noise removal, AI background removal, chroma key, stock media integrations.**

---

## 12. Source links

- Movavi: https://www.movavi.com/video-editor-plus/
- CapCut online editor: https://www.capcut.com/tools/online-video-editor
- WebCodecs API: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- ffmpeg.wasm: https://ffmpegwasm.netlify.app/docs/overview/
- Remotion: https://www.remotion.dev/
- Mux Direct Uploads: https://www.mux.com/docs/guides/upload-files-directly
- Descript (transcript-editing inspiration): https://www.descript.com/
