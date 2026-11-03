// One-off check of /clubhouse/shop, signed in as a Clerk test user (fresh headless Chromium, never the user's Chrome).
// Every size: scroll so lazy product photos load, then a full-page shot. Then the interactions: watch a category,
// watch one with nothing on sale, filter, Tab focus, the 4-category limit, and unwatch everything again.
// Usage: BASE=http://localhost:3400 node scripts/shop-check.mjs <outDir>
import { chromium } from "@playwright/test";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import fs from "fs";

process.loadEnvFile(".env.local");
const out = process.argv[2] ?? "screenshots/shop";
const base = process.env.BASE ?? "http://localhost:3400";
fs.mkdirSync(out, { recursive: true });
await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, dotenv: false });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errs.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await setupClerkTestingToken({ page });
await page.goto(`${base}/clubhouse`);
await clerk.signIn({ page, emailAddress: "golfer-a+clerk_test@example.com" });

const settle = async () => {
  await page.waitForSelector('ul[aria-label] li a', { timeout: 20000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
};
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const report = [];

// 1. Every size.
const sizes = [[320, 700], [375, 812], [390, 844], [430, 932], [844, 390], [768, 1024], [1024, 768], [1280, 900], [1440, 900], [1920, 1080], [2560, 1440]];
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  errs.length = 0;
  await page.goto(`${base}/clubhouse/shop`);
  await settle();
  const f = `${out}/shop-${w}x${h}.jpg`;
  await page.screenshot({ path: f, fullPage: true, type: "jpeg", quality: 70 });
  report.push({ shot: f, overflowPx: await overflow(), errors: [...errs] });
}

// 2. Interactions at 390 (phone) and 1280.
for (const w of [390, 1280]) {
  await page.setViewportSize({ width: w, height: w < 600 ? 844 : 900 });
  await page.goto(`${base}/clubhouse/shop`);
  await settle();
  const watchGroup = page.getByRole("group", { name: "Watch a category" });
  // Watch Balls and Other (Other has nothing on sale: the "no deals in this category" state).
  for (const name of ["Balls", "Other"]) {
    const chip = watchGroup.getByRole("button", { name: new RegExp(`^${name}`) });
    if ((await chip.getAttribute("aria-pressed")) !== "true") { await chip.click(); await page.waitForTimeout(1500); }
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/shop-${w}-watching.jpg`, fullPage: false, type: "jpeg", quality: 70 });
  await page.locator("#watch-h").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/shop-${w}-watching-full.jpg`, fullPage: true, type: "jpeg", quality: 70 });
  // Filter the rest to Hats.
  await page.getByRole("group", { name: "Show one category" }).getByRole("button", { name: /^Hats/ }).click();
  await page.waitForTimeout(400);
  await page.locator("#rest-h").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/shop-${w}-filter-hats.jpg`, fullPage: false, type: "jpeg", quality: 70 });
  // Keyboard: Tab into the page until a deal card link has focus; shoot the ring.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("#watch-h").focus().catch(() => {});
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => !!document.activeElement?.closest("ul[aria-label] li a"))) break;
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/shop-${w}-focus-card.jpg`, fullPage: false, type: "jpeg", quality: 70 });
  // Hover a card.
  if (w === 1280) {
    await page.locator("ul[aria-label] li a").first().hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/shop-${w}-hover-card.jpg`, fullPage: false, type: "jpeg", quality: 70 });
  }
  // The limit: watch 4, then try a 5th (toast), screenshot, then unwatch all.
  if (w === 1280) {
    for (const name of ["Hats", "Apparel", "Bags"]) {
      const chip = watchGroup.getByRole("button", { name: new RegExp(`^${name}`) });
      if ((await chip.getAttribute("aria-pressed")) !== "true") { await chip.click(); await page.waitForTimeout(1500); }
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#watch-h").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/shop-${w}-limit.jpg`, fullPage: false, type: "jpeg", quality: 70 });
  }
  // Unwatch everything so the next run starts clean.
  for (const name of ["Balls", "Other", "Hats", "Apparel", "Bags", "Training"]) {
    const chip = watchGroup.getByRole("button", { name: new RegExp(`^${name}`) });
    if ((await chip.getAttribute("aria-pressed")) === "true") { await chip.click(); await page.waitForTimeout(1500); }
  }
}
const watching = await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby="watch-chips-label"] [aria-pressed="true"]')].map((e) => e.textContent));
report.push({ afterCleanupWatching: watching, errors: [...errs] });
console.log(JSON.stringify(report, null, 1));
await b.close();
