// Verify the SERVER renderer applies media overlays (logo + b-roll), matching
// the browser. Local dev (mock transcript) → add magenta logo + red b-roll →
// "Render on server" → check the exported frame at t=1.5s: logo region magenta,
// center red. Usage: npm run dev, then node e2e/verify-server-parity.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const URL = "http://localhost:3000/editor";
const isMagenta = (c) => c.r > 170 && c.g < 90 && c.b > 170;
const isRed = (c) => c.r > 150 && c.g < 90 && c.b < 90;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // magenta logo
  const dataUrl = await page.evaluate(() => { const c=document.createElement("canvas"); c.width=256;c.height=256; const x=c.getContext("2d"); x.fillStyle="#FF00FF"; x.fillRect(0,0,256,256); return c.toDataURL("image/png"); });
  fs.writeFileSync("/tmp/logo.png", Buffer.from(dataUrl.split(",")[1], "base64"));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles("/tmp/sample_audio.mp4");
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Clean up$/i }).click();

  // export once (browser) to load __ccFFmpeg, then make a red b-roll clip
  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  await page.getByRole("link", { name: /Download MP4/i }).waitFor({ timeout: 240000 });
  const redB64 = await page.evaluate(async () => {
    const ff = window.__ccFFmpeg;
    await ff.exec(["-f","lavfi","-i","color=c=red:s=320x240:d=2:r=15","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","red.mp4"]);
    const d = await ff.readFile("red.mp4"); const u=d instanceof Uint8Array?d:new Uint8Array(d);
    let s=""; for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); await ff.deleteFile("red.mp4").catch(()=>{}); return btoa(s);
  });
  fs.writeFileSync("/tmp/red.mp4", Buffer.from(redB64, "base64"));

  // add logo + red b-roll (start=1), turn ON server render
  await page.locator('input[accept*="image/png"]').setInputFiles("/tmp/logo.png");
  await page.locator('input[accept*="video"]').setInputFiles("/tmp/red.mp4");
  await page.locator('input[type="number"]').waitFor({ timeout: 10000 });
  await page.locator('input[type="number"]').fill("1");
  await page.locator('label', { hasText: /Render on server/i }).locator('input[type="checkbox"]').check();

  // server export
  await page.getByRole("button", { name: /Export MP4/i }).first().click();
  await page.waitForTimeout(2000);
  const dl = page.getByRole("link", { name: /Download MP4/i });
  await dl.waitFor({ timeout: 240000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dl.click()]);
  await download.saveAs("/tmp/cc_parity.mp4");

  const b64 = fs.readFileSync("/tmp/cc_parity.mp4").toString("base64");
  const r = await page.evaluate(async ({ b64 }) => {
    const ff = window.__ccFFmpeg; const W=720;
    await ff.writeFile("p.mp4", Uint8Array.from(atob(b64), c=>c.charCodeAt(0)));
    await ff.exec(["-ss","1.5","-i","p.mp4","-frames:v","1","-f","rawvideo","-pix_fmt","rgba","p.raw"]);
    const raw = await ff.readFile("p.raw"); const px = raw instanceof Uint8Array?raw:new Uint8Array(raw);
    const avg = (y0,y1,x0,x1) => { let r=0,g=0,b=0,n=0; for(let y=y0;y<y1;y+=3)for(let x=x0;x<x1;x+=3){const i=(y*W+x)*4; r+=px[i];g+=px[i+1];b+=px[i+2];n++;} return {r:r/n,g:g/n,b:b/n}; };
    const logo = avg(150,300,290,430);     // top-center (logo)
    const center = avg(650,820,290,430);   // below logo (b-roll fill)
    await ff.deleteFile("p.mp4").catch(()=>{}); await ff.deleteFile("p.raw").catch(()=>{});
    return { logo, center };
  }, { b64 });
  await page.close();

  const pass = isMagenta(r.logo) && isRed(r.center);
  console.log(`logo region rgb=(${r.logo.r|0},${r.logo.g|0},${r.logo.b|0}) magenta=${isMagenta(r.logo)}`);
  console.log(`center region rgb=(${r.center.r|0},${r.center.g|0},${r.center.b|0}) red=${isRed(r.center)}`);
  console.log(`RESULT ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exitCode = 1;
} catch (e) { console.log("RESULT FAIL error=", e.message); process.exitCode = 1; }
finally { await browser.close(); }
