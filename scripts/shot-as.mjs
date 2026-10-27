// Screenshot pages *signed in* as a Clerk test user, in a fresh headless Chromium (never the user's Chrome).
// Signs in with a one-time token from @clerk/testing (needs CLERK_SECRET_KEY: loaded from .env.local into this
// process only, never printed), then visits each path and prints console errors + horizontal overflow.
// Usage: node scripts/shot-as.mjs <golfer-a|golfer-b> <outDir> <width> <path> [path…]   (BASE=http://localhost:3300)
import { chromium } from "@playwright/test";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import fs from "fs";
import path from "path";

process.loadEnvFile(".env.local");
const [who, outDir, w, ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3300";
const width = +w;
await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, dotenv: false });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await setupClerkTestingToken({ page });
await page.goto(`${base}/clubhouse`);
await clerk.signIn({ page, emailAddress: `${who}+clerk_test@example.com` });
fs.mkdirSync(outDir, { recursive: true });
const results = [];
for (const p of paths) {
  errs.length = 0;
  await page.goto(base + p, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(+(process.env.WAIT ?? 2500));
  const out = path.join(outDir, `${who}${p.replaceAll("/", "_") || "_root"}-${width}.jpg`);
  await page.screenshot({ path: out, type: "jpeg", quality: 72, fullPage: process.env.FULL !== "0" });
  const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  results.push({ path: p, out, overflowPx, consoleErrors: [...errs] });
}
await b.close();
console.log(JSON.stringify(results, null, 1));
