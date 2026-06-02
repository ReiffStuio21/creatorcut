// Verify on-device background removal: upload → Replace (green) → the baked clip
// shows green in the preview. (BBB has no person, so the whole frame goes green,
// which confirms the segment→composite→record→swap pipeline ran.)
import { chromium } from "playwright";
const URL = "http://localhost:3000/editor";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl"] });
try {
  const p = await b.newPage();
  p.on("console", (m) => { if (/error/i.test(m.type())) console.log("[console.error]", m.text().slice(0,160)); });
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await p.locator('input[accept*="video"]').setInputFiles("/tmp/sample.mp4"); // silent 10s clip
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: /^Replace$/ }).click();
  // wait for processing to finish (Replace button returns)
  await p.getByText(/Processing background/i).waitFor({ timeout: 20000 }).catch(() => {});
  await p.getByRole("button", { name: /^Replace$/ }).waitFor({ timeout: 120000 });
  await p.waitForTimeout(1500);
  const rgb = await p.evaluate(async () => {
    const v = document.querySelector("video");
    v.pause(); v.currentTime = 2;
    await new Promise((r) => (v.onseeked = r));
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    const x = c.getContext("2d"); x.drawImage(v, 0, 0);
    const d = x.getImageData(c.width * 0.2, c.height * 0.2, c.width * 0.6, c.height * 0.6).data;
    let r = 0, g = 0, bl = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 50) { r += d[i]; g += d[i+1]; bl += d[i+2]; n++; }
    return { r: Math.round(r/n), g: Math.round(g/n), b: Math.round(bl/n) };
  });
  const greenish = rgb.g > 120 && rgb.g > rgb.r + 30 && rgb.g > rgb.b + 30;
  console.log(`baked preview center rgb=(${rgb.r},${rgb.g},${rgb.b}) green=${greenish}`);
  console.log(`RESULT ${greenish ? "PASS" : "FAIL"}`);
  if (!greenish) process.exitCode = 1;
  await p.close();
} catch (e) { console.log("RESULT FAIL error=", e.message); process.exitCode = 1; }
finally { await b.close(); }
