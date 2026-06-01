// Proves captions are actually burned into the exported pixels (not just shown
// in preview). Exports the same cut twice — captions ON and OFF — then extracts
// a frame from each (using the app's already-loaded ffmpeg.wasm via the dev-only
// window.__ccFFmpeg hook) and counts white pixels in the bottom caption band.
// Captions-on must have far more.
//
// Usage: npm run dev (elsewhere), then: CC_SAMPLE=/path/clip.mp4 node e2e/verify-captions.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const SAMPLE = process.env.CC_SAMPLE ?? "/tmp/sample_audio.mp4";
const URL = "http://localhost:3000/editor";
const W = 720, H = 1280; // 9:16 export target
const SEEK = "1.0";

const browser = await chromium.launch();

// Export once; leave the page open so we can reuse its loaded ffmpeg.
async function exportOnce(page, captionsOn) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[type="file"]').setInputFiles(SAMPLE);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Clean up$/i }).click();
  if (!captionsOn) await page.locator('input[type="checkbox"]').uncheck();
  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  const dl = page.getByRole("link", { name: /Download MP4/i });
  await dl.waitFor({ timeout: 240000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dl.click()]);
  const out = `/tmp/cc_${captionsOn ? "capt" : "nocapt"}.mp4`;
  await download.saveAs(out);
  return out;
}

// Extract a frame with the app's loaded ffmpeg and count near-white pixels in
// the bottom caption band.
async function whitePixelsInBand(page, mp4Path) {
  const b64 = fs.readFileSync(mp4Path).toString("base64");
  return page.evaluate(
    async ({ b64, W, H, SEEK }) => {
      const ff = window.__ccFFmpeg;
      if (!ff) throw new Error("app ffmpeg not loaded");
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await ff.writeFile("verify.mp4", bin);
      await ff.exec(["-ss", SEEK, "-i", "verify.mp4", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "verify.raw"]);
      const raw = await ff.readFile("verify.raw");
      const px = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      await ff.deleteFile("verify.mp4").catch(() => {});
      await ff.deleteFile("verify.raw").catch(() => {});
      let white = 0;
      const y0 = Math.floor(H * 0.72), y1 = Math.floor(H * 0.97);
      const x0 = Math.floor(W * 0.15), x1 = Math.floor(W * 0.85);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          if (px[i] >= 235 && px[i + 1] >= 235 && px[i + 2] >= 235) white++;
        }
      }
      return white;
    },
    { b64, W, H, SEEK },
  );
}

try {
  const captPage = await browser.newPage();
  const captPath = await exportOnce(captPage, true);
  const captWhite = await whitePixelsInBand(captPage, captPath);
  await captPage.close();

  const noPage = await browser.newPage();
  const noPath = await exportOnce(noPage, false);
  const noWhite = await whitePixelsInBand(noPage, noPath);
  await noPage.close();

  const pass = captWhite > 800 && captWhite > noWhite * 4;
  console.log(`captions ON  white px in band: ${captWhite}`);
  console.log(`captions OFF white px in band: ${noWhite}`);
  console.log(`RESULT ${pass ? "PASS" : "FAIL"} (captions visibly burned: ${pass})`);
  if (!pass) process.exitCode = 1;
} catch (err) {
  console.log(`RESULT FAIL error=${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
