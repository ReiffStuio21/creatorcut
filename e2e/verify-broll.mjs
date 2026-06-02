// Verify a b-roll cutaway appears in the exported pixels only during its window.
// Generates a solid-RED b-roll clip (via the app's ffmpeg), places it at
// start=1s, exports, and checks: frame at 1.5s is red, frame at 4s is not.
// Runs against LOCAL dev (window.__ccFFmpeg). Usage: npm run dev, then node e2e/verify-broll.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://localhost:3000/editor";
const VIDEO = "/tmp/sample_audio.mp4";
const isRed = (c) => c.r > 150 && c.g < 80 && c.b < 80;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles(VIDEO);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });

  // export once to load the app's ffmpeg, then generate a red b-roll clip
  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  await page.getByRole("link", { name: /Download MP4/i }).waitFor({ timeout: 240000 });
  const redB64 = await page.evaluate(async () => {
    const ff = window.__ccFFmpeg;
    await ff.exec(["-f", "lavfi", "-i", "color=c=red:s=320x240:d=2:r=15", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "red.mp4"]);
    const d = await ff.readFile("red.mp4");
    const u8 = d instanceof Uint8Array ? d : new Uint8Array(d);
    let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    await ff.deleteFile("red.mp4").catch(() => {});
    return btoa(s);
  });
  fs.writeFileSync("/tmp/red.mp4", Buffer.from(redB64, "base64"));

  // add the red b-roll, set start to 1s
  await page.locator('input[accept*="video"]').setInputFiles("/tmp/red.mp4");
  await page.locator('input[type="number"]').waitFor({ timeout: 10000 });
  await page.locator('input[type="number"]').fill("1");
  await page.waitForTimeout(300);

  // export again (now with b-roll): click Export, wait for the re-encode to
  // finish (Download link disappears then reappears), then download.
  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  await page.waitForTimeout(2000); // let the link reset while encoding starts
  const dl2 = page.getByRole("link", { name: /Download MP4/i });
  await dl2.waitFor({ timeout: 240000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dl2.click()]);
  await download.saveAs("/tmp/cc_broll.mp4");

  const b64 = fs.readFileSync("/tmp/cc_broll.mp4").toString("base64");
  const { inWin, after } = await page.evaluate(
    async ({ b64 }) => {
      const ff = window.__ccFFmpeg;
      await ff.writeFile("b.mp4", Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      const W = 720, H = 1280;
      async function centerRGB(t) {
        await ff.exec(["-ss", t, "-i", "b.mp4", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "fr.raw"]);
        const raw = await ff.readFile("fr.raw");
        const px = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = Math.floor(H * 0.4); y < H * 0.6; y += 4)
          for (let x = Math.floor(W * 0.3); x < W * 0.7; x += 4) {
            const i = (y * W + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
          }
        await ff.deleteFile("fr.raw").catch(() => {});
        return { r: r / n, g: g / n, b: b / n };
      }
      const inWin = await centerRGB("1.5");
      const after = await centerRGB("4.0");
      await ff.deleteFile("b.mp4").catch(() => {});
      return { inWin, after };
    },
    { b64 },
  );
  await page.close();

  const pass = isRed(inWin) && !isRed(after);
  console.log(`b-roll window t=1.5s rgb=(${inWin.r.toFixed(0)},${inWin.g.toFixed(0)},${inWin.b.toFixed(0)}) red=${isRed(inWin)}`);
  console.log(`after window t=4.0s rgb=(${after.r.toFixed(0)},${after.g.toFixed(0)},${after.b.toFixed(0)}) red=${isRed(after)}`);
  console.log(`RESULT ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exitCode = 1;
} catch (err) {
  console.log("RESULT FAIL error=", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
