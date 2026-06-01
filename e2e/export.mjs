// Real-browser smoke test of the export pipeline. Drives the actual editor:
// upload → transcribe → clean up → export → download, then validates the MP4.
//
// Usage:  npm run dev   (in another terminal)
//         CC_SAMPLE=/path/to/clip.mp4 node e2e/export.mjs
// Requires Playwright's Chromium (`npx playwright install chromium`) and a
// short sample clip. Works with or without an audio track.
import { chromium } from "playwright";
import fs from "node:fs";

const SAMPLE = process.env.CC_SAMPLE ?? "/tmp/sample.mp4";
const OUT = "/tmp/creatorcut-export.mp4";
const URL = process.env.CC_URL ?? "http://localhost:3000/editor";

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

try {
  await page.goto(URL, { waitUntil: "networkidle" });

  // wait for client JS to hydrate so the upload onChange handler is wired
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[type="file"]').setInputFiles(SAMPLE);
  // give the browser a moment to read metadata (duration)
  await page.waitForTimeout(2500);

  await page
    .getByRole("button", { name: /Generate transcript/i })
    .click({ timeout: 15000 });

  // transcript done → editing toolbar appears
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Clean up$/i }).click();

  // kick off export (header CTA)
  await page.getByRole("button", { name: /Export MP4/i }).first().click();

  // encode can take a while (CDN core fetch + wasm x264)
  const dl = page.getByRole("link", { name: /Download MP4/i });
  await dl.waitFor({ timeout: 240000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dl.click(),
  ]);
  await download.saveAs(OUT);

  const buf = fs.readFileSync(OUT);
  const tag = buf.subarray(4, 8).toString("ascii");
  const ok = buf.length > 10000 && tag === "ftyp";
  console.log(`RESULT ${ok ? "PASS" : "FAIL"} size=${buf.length} tag=${tag}`);
  if (!ok) process.exitCode = 1;
} catch (err) {
  console.log(`RESULT FAIL error=${err.message}`);
  process.exitCode = 1;
} finally {
  console.log("--- browser logs ---");
  console.log(logs.join("\n"));
  await browser.close();
}
