// Verify music + image overlays persist with a project on the live site:
//   sign up → add music + a logo → Save → reload → both are restored.
// Run with: SUPABASE_ACCESS_TOKEN=sbp_... CC_SUPABASE_REF=<ref> node e2e/verify-media-persist.mjs
import { chromium } from "playwright";

const BASE = process.env.CC_URL ?? "https://creatorcut-sepia.vercel.app";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.CC_SUPABASE_REF;
const VIDEO = "/tmp/sample_audio.mp4";
if (!TOKEN || !REF) throw new Error("set SUPABASE_ACCESS_TOKEN and CC_SUPABASE_REF");

async function mgmtQuery(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return r.json();
}

const browser = await chromium.launch();
try {
  // make a magenta logo png
  const maker = await browser.newPage();
  const dataUrl = await maker.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#FF00FF"; ctx.fillRect(0, 0, 256, 256);
    return c.toDataURL("image/png");
  });
  await maker.close();
  const fs = await import("node:fs");
  fs.writeFileSync("/tmp/logo.png", Buffer.from(dataUrl.split(",")[1], "base64"));

  const page = await browser.newPage();
  // sign up
  const email = `cc-media-${Date.now()}@example.com`;
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.locator('input[name="full_name"]').fill("Media Test");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.getByRole("button", { name: /^Sign up$/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });

  // editor: upload → transcribe → add music + logo → Save
  await page.goto(`${BASE}/editor`, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles(VIDEO);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 60000 });
  await page.locator('input[accept*="audio"]').setInputFiles(VIDEO);
  await page.locator('input[accept*="image/png"]').setInputFiles("/tmp/logo.png");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.getByRole("button", { name: /^Saved$/ }).waitFor({ timeout: 90000 });
  console.log("saved project with music + logo");

  // DB + storage checks
  const rows = await mgmtQuery(
    "select id, (media->'music') is not null as has_music, jsonb_array_length(coalesce(media->'images','[]')) as n_images from public.projects;",
  );
  const objs = await mgmtQuery("select count(*)::int n from storage.objects where bucket_id='videos';");
  console.log(`DB: has_music=${rows[0]?.has_music} images=${rows[0]?.n_images} | storage objects=${objs[0]?.n}`);

  // reload → confirm restored in the UI
  await page.goto(`${BASE}/editor?project=${rows[0].id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(8000); // download video + media + hydrate
  const musicSlider = await page.locator('input[type="range"]').count(); // music volume slider
  const positionBtns = await page.locator('button[aria-label^="Position"]').count(); // 9 per image
  console.log(`reload: musicSlider=${musicSlider} positionButtons=${positionBtns}`);

  const pass =
    rows[0]?.has_music === true &&
    Number(rows[0]?.n_images) === 1 &&
    objs[0]?.n >= 3 &&
    musicSlider === 1 &&
    positionBtns === 9;
  console.log(`RESULT ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exitCode = 1;
  await page.close();
} catch (err) {
  console.log("RESULT FAIL error=", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
