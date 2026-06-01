// Proves the "Mono" look actually grayscales the exported pixels. Exports with
// Mono selected, extracts a frame, and checks that nearly all pixels are neutral
// (r≈g≈b). Uses the app's loaded ffmpeg (window.__ccFFmpeg).
//
// Usage: npm run dev (elsewhere), then: node e2e/verify-filter.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const VIDEO = process.env.CC_SAMPLE ?? "/tmp/sample_audio.mp4";
const URL = "http://localhost:3000/editor";
const W = 720;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles(VIDEO);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Clean up$/i }).click();
  await page.getByRole("button", { name: /^Mono$/ }).click(); // pick the Mono look

  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  const dl = page.getByRole("link", { name: /Download MP4/i });
  await dl.waitFor({ timeout: 240000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dl.click()]);
  await download.saveAs("/tmp/cc_mono.mp4");

  const b64 = fs.readFileSync("/tmp/cc_mono.mp4").toString("base64");
  const ratio = await page.evaluate(
    async ({ b64, W }) => {
      const ff = window.__ccFFmpeg;
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await ff.writeFile("m.mp4", bin);
      await ff.exec(["-ss", "1.0", "-i", "m.mp4", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "m.raw"]);
      const raw = await ff.readFile("m.raw");
      const px = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      let neutral = 0, total = 0;
      // sample a central region every few pixels
      for (let y = 300; y < 980; y += 4) {
        for (let x = 100; x < 620; x += 4) {
          const i = (y * W + x) * 4;
          const r = px[i], g = px[i + 1], b = px[i + 2];
          const spread = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          if (spread <= 12) neutral++;
          total++;
        }
      }
      await ff.deleteFile("m.mp4").catch(() => {});
      await ff.deleteFile("m.raw").catch(() => {});
      return neutral / total;
    },
    { b64, W },
  );
  await page.close();

  const pass = ratio > 0.95;
  console.log(`neutral (grayscale) pixel ratio: ${(ratio * 100).toFixed(1)}%`);
  console.log(`RESULT ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exitCode = 1;
} catch (err) {
  console.log(`RESULT FAIL error=${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
