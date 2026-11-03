// Proof that the Pro Shop updates without a reload: open it signed in, count Realtime frames for worker_runs and
// shop_deals as they arrive on the page's own WebSocket, and read the freshness line before and after a cron tick.
// Usage: BASE=http://localhost:3400 node scripts/shop-realtime-check.mjs <outDir> [minutes]
import { chromium } from "@playwright/test";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import fs from "fs";

process.loadEnvFile(".env.local");
const out = process.argv[2] ?? "screenshots/shop";
const minutes = +(process.argv[3] ?? 6);
const base = process.env.BASE ?? "http://localhost:3400";
fs.mkdirSync(out, { recursive: true });
await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, dotenv: false });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
// Record every Realtime postgres_changes frame (table + event type) the page receives. Read-only: it only listens.
// Each frame goes straight to this Node process (so a reload can't lose it), and page loads are counted.
const frames = [];
let loads = 0;
await ctx.exposeFunction("__rtFrame", (f) => { frames.push(f); });
await ctx.addInitScript(() => {
  const WS = window.WebSocket;
  window.WebSocket = class extends WS {
    constructor(...a) {
      super(...a);
      this.addEventListener("message", (e) => {
        try {
          if (typeof e.data !== "string") return;
          const raw = JSON.parse(e.data);
          // Phoenix v2 frames are arrays [join_ref, ref, topic, event, payload]; v1 frames are objects.
          const m = Array.isArray(raw) ? { event: raw[3], payload: raw[4] } : raw;
          const d = m?.payload?.data;
          if (m.event === "postgres_changes" && d) window.__rtFrame({ at: new Date().toISOString(), table: d.table, type: d.type, id: d.record?.id ?? d.old_record?.id ?? null, detail: d.record?.detail ?? null });
        } catch { /* not JSON */ }
      });
    }
  };
});
const page = await ctx.newPage();
page.on("load", () => { loads++; });
await setupClerkTestingToken({ page });
await page.goto(`${base}/clubhouse`);
await clerk.signIn({ page, emailAddress: "golfer-a+clerk_test@example.com" });
// The redirect: the old Flights URL lands on the shop.
await page.goto(`${base}/clubhouse/flights`);
const redirectedTo = new URL(page.url()).pathname;
await page.waitForSelector("ul[aria-label] li a", { timeout: 20000 });
const fresh = () => page.locator('section[aria-labelledby="rest-h"] p', { hasText: /Updated|Last updated|Checking|down/ }).first().textContent();
const before = await fresh();
const loadedAt = new Date().toISOString();
const loadsAtStart = loads;
await page.waitForTimeout(minutes * 60_000);
const after = await fresh();
await page.screenshot({ path: `${out}/shop-realtime-after.jpg`, type: "jpeg", quality: 70 });
console.log(JSON.stringify({ redirectedTo, loadedAt, freshnessBefore: before, freshnessAfter: after, reloadsDuringWatch: loads - loadsAtStart, realtime: frames.filter((r) => r.table === "shop_deals" || /on sale/.test(r.detail ?? "")) }, null, 1));
await b.close();
