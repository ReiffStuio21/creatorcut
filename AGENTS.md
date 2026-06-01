<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CreatorCut

A beginner-first AI video editor. The differentiator: **edit your video by editing its transcript** (delete the text, the video cuts to match).

**`PLAN.md` is the single source of truth.** Read it before starting any work, and build one vertical slice (phase) at a time — don't move on until the current slice works end to end.

Key architecture (PLAN.md §4): the **EDL** ([src/lib/edl/](src/lib/edl/)) is the single edit model that both the preview and every renderer read; rendering hides behind one swappable `Renderer` interface ([src/lib/render/renderer.ts](src/lib/render/renderer.ts)); AI work is an explicit pipeline; a cost meter tracks API spend. EDL operations are pure functions with a real unit-test suite (`npm test`).

Next 16 notes: `middleware.ts` is renamed to `proxy.ts`; Supabase auth follows the same SSR pattern as the Tyanna app. Stack: Next 16 + TS + Tailwind v4 + Supabase + Zustand; FFmpeg.wasm added at Phase 6.
