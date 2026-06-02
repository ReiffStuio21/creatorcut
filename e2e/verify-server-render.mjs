// Verify the client→worker server-render path: local dev (mock transcript →
// real segments) renders via the Fly worker and downloads a valid MP4.
import { chromium } from "playwright";
import fs from "node:fs";
const URL = "http://localhost:3000/editor";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles("/tmp/sample_audio.mp4");
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Clean up$/i }).click();
  // turn on "Render on server"
  await page.locator('label', { hasText: /Render on server/i }).locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  const dl = page.getByRole("link", { name: /Download MP4/i });
  await dl.waitFor({ timeout: 180000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dl.click()]);
  await download.saveAs("/tmp/cc_srv2.mp4");
  const buf = fs.readFileSync("/tmp/cc_srv2.mp4");
  const ok = buf.length > 10000 && buf.subarray(4, 8).toString("ascii") === "ftyp";
  console.log(`RESULT ${ok ? "PASS" : "FAIL"} size=${buf.length} tag=${buf.subarray(4,8).toString("ascii")}`);
  if (!ok) process.exitCode = 1;
  await page.close();
} catch (e) { console.log("RESULT FAIL error=", e.message); process.exitCode = 1; }
finally { await browser.close(); }
