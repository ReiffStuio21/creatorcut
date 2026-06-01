// Proves Phase 5 media lands in the export: a magenta logo overlay shows up in
// the exported pixels at its position, and background music adds an audio stream.
// Uses the app's loaded ffmpeg (window.__ccFFmpeg) to extract/probe the output.
//
// Usage: npm run dev (elsewhere), then: node e2e/verify-media.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const VIDEO = process.env.CC_SAMPLE ?? "/tmp/sample_audio.mp4"; // has audio
const LOGO = "/tmp/logo.png";
const URL = "http://localhost:3000/editor";
const W = 720, H = 1280;

const browser = await chromium.launch();

async function makeLogo() {
  const p = await browser.newPage();
  const dataUrl = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#FF00FF";
    ctx.fillRect(0, 0, 256, 256);
    return c.toDataURL("image/png");
  });
  await p.close();
  fs.writeFileSync(LOGO, Buffer.from(dataUrl.split(",")[1], "base64"));
}

try {
  await makeLogo();
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles(VIDEO);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Clean up$/i }).click();

  // add a logo (default position: top-center) and background music
  await page.locator('input[accept*="image/png"]').setInputFiles(LOGO);
  await page.locator('input[accept*="audio"]').setInputFiles(VIDEO);
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  const dl = page.getByRole("link", { name: /Download MP4/i });
  await dl.waitFor({ timeout: 240000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dl.click()]);
  await download.saveAs("/tmp/cc_media.mp4");

  const b64 = fs.readFileSync("/tmp/cc_media.mp4").toString("base64");
  const result = await page.evaluate(
    async ({ b64, W, H }) => {
      const ff = window.__ccFFmpeg;
      if (!ff) throw new Error("app ffmpeg not loaded");
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await ff.writeFile("verify.mp4", bin);

      // probe for an audio stream
      let log = "";
      const onLog = ({ message }) => (log += message + "\n");
      ff.on("log", onLog);
      await ff.exec(["-i", "verify.mp4"]).catch(() => {});
      ff.off("log", onLog);
      const hasAudio = /: Audio:/.test(log);

      // extract a frame and count magenta pixels in the logo region (top-center)
      await ff.exec(["-ss", "1.0", "-i", "verify.mp4", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "f.raw"]);
      const raw = await ff.readFile("f.raw");
      const px = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      let magenta = 0;
      for (let y = 150; y < 300; y++) {
        for (let x = 280; x < 440; x++) {
          const i = (y * W + x) * 4;
          if (px[i] > 180 && px[i + 1] < 90 && px[i + 2] > 180) magenta++;
        }
      }
      await ff.deleteFile("verify.mp4").catch(() => {});
      await ff.deleteFile("f.raw").catch(() => {});
      return { hasAudio, magenta };
    },
    { b64, W, H },
  );
  await page.close();

  const pass = result.magenta > 2000 && result.hasAudio;
  console.log(`logo magenta px in region: ${result.magenta}`);
  console.log(`output has audio stream: ${result.hasAudio}`);
  console.log(`RESULT ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exitCode = 1;
} catch (err) {
  console.log(`RESULT FAIL error=${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
