// Standalone EDL → FFmpeg translation for the server renderer. Mirrors the
// browser's src/lib/render/ffmpeg-args.ts (kept in sync by hand) but targets a
// real ffmpeg binary and a single video input. v1 scope: cut + concat + aspect +
// color filter + transition + burned captions (the core for long talking-head
// clips). Music/logo/b-roll overlays remain on the browser path for now.

const TARGET_SIZES = {
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 720, height: 720 },
  "16:9": { width: 1280, height: 720 },
};

const FILTERS = {
  none: "",
  warm: "colorbalance=rs=0.10:gs=0.02:bs=-0.10,eq=saturation=1.1",
  cool: "colorbalance=rs=-0.10:bs=0.10,eq=saturation=1.05",
  mono: "hue=s=0",
  vivid: "eq=saturation=1.5:contrast=1.1",
  bright: "eq=brightness=0.08:contrast=1.05",
};

const FADE = 0.4;
const FILLERS = new Set(["um", "uh", "umm", "uhh", "mm", "hmm", "er", "ah", "like"]);

const kept = (edl) => edl.segments.filter((s) => s.kept);
const outputDuration = (edl) => kept(edl).reduce((a, s) => a + (s.end - s.start), 0);

function sourceToOutputTime(edl, t) {
  let out = 0;
  for (const s of kept(edl)) {
    if (t >= s.end) out += s.end - s.start;
    else if (t <= s.start) return out;
    else return out + (t - s.start);
  }
  return out;
}

// caption cues (output time) → SRT
function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(
    Math.floor((ms % 60000) / 1000),
  )},${p(ms % 1000, 3)}`;
}

export function buildSrt(edl) {
  const cues = [];
  let buf = [];
  let lastEnd = null;
  const flush = () => {
    if (!buf.length) return;
    cues.push({
      start: sourceToOutputTime(edl, buf[0].start),
      end: sourceToOutputTime(edl, buf[buf.length - 1].end),
      text: buf.map((w) => w.text).join(" "),
    });
    buf = [];
  };
  for (const s of kept(edl)) {
    const text = (s.text || "").trim();
    if (s.reason === "silence" || text === "" || text === "—") {
      flush();
      lastEnd = s.end;
      continue;
    }
    if (buf.length && ((lastEnd !== null && s.start - lastEnd > 0.4) || buf.length >= 6)) flush();
    buf.push({ start: s.start, end: s.end, text });
    lastEnd = s.end;
  }
  flush();
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}

function assColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "#FFFFFF").trim());
  const rgb = m ? m[1] : "FFFFFF";
  return `&H00${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}`.toUpperCase();
}

function forceStyle(captions) {
  const base = [`FontName=Roboto`, `PrimaryColour=${assColor(captions.color)}`, "Alignment=2", "MarginV=48"];
  if (captions.style === "boxed-center")
    base.push("FontSize=18", "BorderStyle=3", "BackColour=&H80000000", "Outline=0", "Shadow=0");
  else if (captions.style === "clean-bottom") base.push("FontSize=16", "Bold=0", "Outline=1", "Shadow=1");
  else base.push("FontSize=20", "Bold=-1", "Outline=2", "Shadow=1");
  return base.join(",");
}

/**
 * Build ffmpeg argv (full parity with the browser ffmpeg-args). `inputPath` =
 * source video. The EDL's tracks carry LOCAL FILE PATHS in `src` (the server
 * rewrites the client's upload keys → paths). `srtPath` = burn-in subtitles.
 */
export function buildArgs(edl, { inputPath, srtPath, outPath, withAudio }) {
  const segs = kept(edl);
  if (!segs.length) throw new Error("Nothing to export — every word was removed.");
  const { width: w, height: h } = TARGET_SIZES[edl.aspectRatio] ?? TARGET_SIZES["9:16"];
  const outSeconds = outputDuration(edl);
  const music = edl.tracks?.music?.[0]; // { src: path, volume }
  const images = edl.tracks?.images ?? []; // [{ src: path, x, y }]
  const broll = edl.tracks?.broll ?? []; // [{ src: path, start, duration }]

  // input indices: video(0), music, images, b-roll
  let nextIndex = 1;
  const musicIndex = music ? nextIndex++ : -1;
  const imageIndices = images.map(() => nextIndex++);
  const brollIndices = broll.map(() => nextIndex++);

  const parts = [];
  const concatInputs = [];
  segs.forEach((s, i) => {
    parts.push(
      `[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS,` +
        `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[v${i}]`,
    );
    if (withAudio) parts.push(`[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS[a${i}]`);
    concatInputs.push(withAudio ? `[v${i}][a${i}]` : `[v${i}]`);
  });
  const concat = withAudio
    ? `${concatInputs.join("")}concat=n=${segs.length}:v=1:a=1[vcat][outa]`
    : `${concatInputs.join("")}concat=n=${segs.length}:v=1:a=0[vcat]`;

  // video chain: filter → b-roll → captions → image overlays → fade
  const chain = [...parts, concat];
  let v = "[vcat]";
  const filter = FILTERS[edl.filter] || "";
  if (filter) {
    chain.push(`${v}${filter}[vf]`);
    v = "[vf]";
  }
  broll.forEach((b, k) => {
    const idx = brollIndices[k];
    const end = (b.start + b.duration).toFixed(2);
    chain.push(
      `[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,setpts=PTS+${b.start}/TB[bk${k}]`,
    );
    chain.push(`${v}[bk${k}]overlay=enable='between(t,${b.start},${end})'[bov${k}]`);
    v = `[bov${k}]`;
  });
  if (srtPath && edl.captions?.enabled) {
    chain.push(`${v}subtitles=${srtPath}:force_style='${forceStyle(edl.captions)}'[vcap]`);
    v = "[vcap]";
  }
  images.forEach((im, k) => {
    const idx = imageIndices[k];
    chain.push(`[${idx}:v]scale=${Math.round(w * 0.25)}:-1[img${k}]`);
    chain.push(
      `${v}[img${k}]overlay=x=(W-w)*${(im.x / 100).toFixed(4)}:y=(H-h)*${(im.y / 100).toFixed(4)}[ov${k}]`,
    );
    v = `[ov${k}]`;
  });
  const fadeStart = Math.max(0, outSeconds - FADE).toFixed(2);
  const vEnd =
    edl.transition === "fade"
      ? `fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeStart}:d=${FADE}`
      : "null";
  chain.push(`${v}${vEnd}[outv]`);

  // audio: speech + music mix + fade
  let aout = withAudio ? "[outa]" : null;
  if (music) {
    chain.push(
      `[${musicIndex}:a]volume=${music.volume},atrim=0:${outSeconds},asetpts=PTS-STARTPTS[mus]`,
    );
  }
  if (withAudio && music) {
    chain.push(`[outa][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[amix]`);
    aout = "[amix]";
  } else if (!withAudio && music) {
    aout = "[mus]";
  }
  if (edl.transition === "fade" && aout) {
    chain.push(`${aout}afade=t=in:st=0:d=${FADE},afade=t=out:st=${fadeStart}:d=${FADE}[aoutf]`);
    aout = "[aoutf]";
  }

  // inputs in index order
  const args = ["-i", inputPath];
  if (music) args.push("-i", music.src);
  images.forEach((im) => args.push("-i", im.src));
  broll.forEach((b) => args.push("-i", b.src));

  args.push("-filter_complex", chain.join(";"), "-map", "[outv]");
  if (aout) args.push("-map", aout);
  args.push("-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p");
  if (aout) args.push("-c:a", "aac");
  else args.push("-an");
  args.push("-movflags", "+faststart", "-y", outPath);
  return args;
}

export { outputDuration, FILLERS };
