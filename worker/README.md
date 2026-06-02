# CreatorCut render worker

A tiny ffmpeg service for **server-side rendering of long clips** — the
`ServerRenderer` backend of the `Renderer` seam (PLAN.md §4b). It receives the
source video + EDL, renders with real ffmpeg (no browser memory limits), and
streams the MP4 back. The EDL→ffmpeg translation in [`render.mjs`](render.mjs)
mirrors the browser's `src/lib/render/ffmpeg-args.ts` so the same edit renders
identically.

**v1 scope:** cut + concat + aspect + color filter + transition + burned
captions (the core for long talking-head clips). Music / logo / b-roll overlays
stay on the browser path for now.

## API
- `POST /render` — multipart: `edl` (JSON field) + `video` (file). Returns `video/mp4`.
- `GET /health` — `ok`.

## Deploy to Fly.io
```sh
# one-time: install flyctl + log in (needs a Fly account with a card on file)
curl -L https://fly.io/install.sh | sh
fly auth login            # or: export FLY_API_TOKEN=...

cd worker
fly launch --copy-config --no-deploy --name creatorcut-render --region iad
fly deploy --remote-only  # Fly builds the Dockerfile remotely (no local Docker)
```
Then point the app at it: set `NEXT_PUBLIC_RENDER_WORKER_URL=https://creatorcut-render.fly.dev`
in Vercel and redeploy. The editor's "Render on server" toggle appears when that
env var is set.

## Run locally (needs ffmpeg installed)
```sh
npm install && npm start   # listens on :8080
```
