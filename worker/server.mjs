// CreatorCut render worker: receives a source video + EDL, renders with real
// ffmpeg (no browser memory limits → handles long clips), streams the MP4 back.
import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Busboy from "busboy";
import { buildArgs, buildSrt } from "./render.mjs";

const PORT = process.env.PORT || 8080;
const TMP = os.tmpdir();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(stderr) : reject(new Error(stderr.slice(-1500)))));
  });
}

async function hasAudio(input) {
  try {
    const p = spawn("ffprobe", [
      "-v", "error", "-select_streams", "a:0",
      "-show_entries", "stream=codec_type", "-of", "csv=p=0", input,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    await new Promise((r) => p.on("close", r));
    return out.includes("audio");
  } catch {
    return false;
  }
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method === "GET" && req.url === "/health") return res.writeHead(200).end("ok");
  if (req.method !== "POST" || req.url !== "/render") return res.writeHead(404).end("not found");

  const id = randomUUID();
  const inPath = path.join(TMP, `${id}-in`);
  const outPath = path.join(TMP, `${id}-out.mp4`);
  const srtPath = path.join(TMP, `${id}.srt`);
  const cleanup = () => [inPath, outPath, srtPath].forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));

  let edl = null;
  const bb = Busboy({ headers: req.headers, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

  bb.on("field", (name, val) => {
    if (name === "edl") {
      try {
        edl = JSON.parse(val);
      } catch {
        edl = null;
      }
    }
  });
  bb.on("file", (_name, stream) => stream.pipe(fs.createWriteStream(inPath)));
  bb.on("close", async () => {
    try {
      if (!edl) throw new Error("missing edl");
      fs.writeFileSync(srtPath, buildSrt(edl));
      const withAudio = await hasAudio(inPath);
      const args = buildArgs(edl, { inputPath: inPath, srtPath, outPath, withAudio });
      await run("ffmpeg", args);
      const stat = fs.statSync(outPath);
      res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": stat.size });
      const rs = fs.createReadStream(outPath);
      rs.pipe(res);
      rs.on("close", cleanup);
    } catch (err) {
      cleanup();
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`render failed: ${err.message}`);
    }
  });
  req.pipe(bb);
});

server.listen(PORT, () => console.log(`render worker on :${PORT}`));
