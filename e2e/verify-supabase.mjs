// End-to-end verification of Supabase persistence on the live site:
//   sign up → editor → transcribe → set aspect 1:1 + Mono look → Save →
//   reload the project → confirm the edit (EDL settings + video) persisted.
// Also checks the DB row + Storage object via the Management API.
import { chromium } from "playwright";

// Run with: SUPABASE_ACCESS_TOKEN=sbp_... CC_SUPABASE_REF=<ref> node e2e/verify-supabase.mjs
const BASE = process.env.CC_URL ?? "https://creatorcut-sepia.vercel.app";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.CC_SUPABASE_REF;
const VIDEO = process.env.CC_SAMPLE ?? "/tmp/sample_audio.mp4";
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
  const page = await browser.newPage();

  // 1. sign up → dashboard
  const email = `cc-test-${Date.now()}@example.com`;
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.locator('input[name="full_name"]').fill("Test User");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.getByRole("button", { name: /^Sign up$/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  console.log("signup → dashboard OK for", email);

  // 2. editor: upload → transcribe → set aspect 1:1 + Mono → Save
  await page.goto(`${BASE}/editor`, { waitUntil: "networkidle" });
  await page.getByText(/Drop a video here/i).waitFor({ timeout: 20000 });
  await page.locator('input[accept*="video"]').setInputFiles(VIDEO);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Generate transcript/i }).click();
  await page.getByRole("button", { name: /^Clean up$/i }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "1:1", exact: true }).click();
  await page.getByRole("button", { name: "Mono", exact: true }).click();
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.getByRole("button", { name: /^Saved$/ }).waitFor({ timeout: 60000 });
  console.log("saved project (aspect 1:1, look Mono)");

  // 3. data checks
  const rows = await mgmtQuery(
    "select id, edl->>'aspectRatio' as ar, edl->>'filter' as filter, video_path from public.projects;",
  );
  const objs = await mgmtQuery("select name from storage.objects where bucket_id = 'videos';");
  console.log(
    `DB: rows=${rows.length} aspectRatio=${rows[0]?.ar} filter=${rows[0]?.filter} | Storage objects=${objs.length}`,
  );

  // 4. reload the project → confirm hydration
  const projectId = rows[0]?.id;
  await page.goto(`${BASE}/editor?project=${projectId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(7000); // download video + hydrate
  const hasVideo = (await page.locator("video").count()) === 1;
  const monoClass = (await page.getByRole("button", { name: "Mono", exact: true }).getAttribute("class")) ?? "";
  const oneOneClass = (await page.getByRole("button", { name: "1:1", exact: true }).getAttribute("class")) ?? "";
  const monoActive = monoClass.includes("bg-foreground");
  const aspectActive = oneOneClass.includes("bg-foreground");
  console.log(`reload: video=${hasVideo} monoActive=${monoActive} aspect1:1Active=${aspectActive}`);

  const pass =
    rows.length === 1 &&
    rows[0].ar === "1:1" &&
    rows[0].filter === "mono" &&
    objs.length >= 1 &&
    hasVideo &&
    monoActive &&
    aspectActive;
  console.log(`RESULT ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exitCode = 1;
  await page.close();
} catch (err) {
  console.log("RESULT FAIL error=", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
