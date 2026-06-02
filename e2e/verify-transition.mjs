// Verify the "Fade" transition darkens the opening frame in the exported pixels.
// Runs against a LOCAL dev server (which exposes window.__ccFFmpeg). Compares
// average brightness at t≈0.05s (during fade-in) vs t≈1.0s (full).
// Usage: npm run dev (elsewhere), then: node e2e/verify-transition.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://localhost:3000/editor";
const VIDEO = "/tmp/sample_audio.mp4";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles(VIDEO);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Fade", exact: true }).click();
  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  const dl = page.getByRole("link", { name: /Download MP4/i });
  await dl.waitFor({ timeout: 240000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dl.click()]);
  await download.saveAs("/tmp/cc_fade.mp4");

  const b64 = fs.readFileSync("/tmp/cc_fade.mp4").toString("base64");
  const { early, mid } = await page.evaluate(
    async ({ b64 }) => {
      const ff = window.__ccFFmpeg;
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await ff.writeFile("f.mp4", bin);
      async function avgLuma(t) {
        await ff.exec(["-ss", t, "-i", "f.mp4", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "fr.raw"]);
        const raw = await ff.readFile("fr.raw");
        const px = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        let sum = 0, n = 0;
        for (let i = 0; i < px.length; i += 4 * 37) {
          sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          n++;
        }
        await ff.deleteFile("fr.raw").catch(() => {});
        return sum / n;
      }
      const early = await avgLuma("0.05");
      const mid = await avgLuma("1.0");
      await ff.deleteFile("f.mp4").catch(() => {});
      return { early, mid };
    },
    { b64 },
  );
  await page.close();

  const pass = early < 50 && mid > early * 2;
  console.log(`avg luma — early(0.05s, fading in)=${early.toFixed(1)} mid(1.0s)=${mid.toFixed(1)}`);
  console.log(`RESULT ${pass ? "PASS" : "FAIL"} (opening frame is dark, mid is bright)`);
  if (!pass) process.exitCode = 1;
} catch (err) {
  console.log("RESULT FAIL error=", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
