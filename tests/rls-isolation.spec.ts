import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Two golfers each save a card through the real app (browser → Server Action → Clerk → Supabase), then each
// opens Cards in a fresh browser. Each must see their own card and never the other's. The app's reads have
// no user_id filter: only Row Level Security keeps the journals apart, so this test fails if RLS is broken.
const RUN = Date.now().toString(36);
const GOLFERS = [
  { who: "golfer-a", note: `Avery's private card ${RUN}` },
  { who: "golfer-b", note: `Blake's private card ${RUN}` },
] as const;

async function signedIn(browser: Browser, who: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await setupClerkTestingToken({ page });
  await page.goto("/clubhouse");
  await clerk.signIn({ page, emailAddress: `${who}+clerk_test@example.com` });
  return page;
}

test("a signed-out visitor sees no one's cards", async ({ page }) => {
  await page.goto("/clubhouse/rounds");
  await expect(page).toHaveURL(/sign-in|accounts\.dev/);
  for (const g of GOLFERS) await expect(page.getByText(g.note)).toHaveCount(0);
});

test("the Data API gives a signed-out caller (publishable key, no token) no rows", async ({ request }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/rounds?select=note`, { headers: { apikey: key } });
  const rows = res.ok() ? await res.json() : [];
  expect(rows, `anon read returned ${res.status()}`).toEqual([]);
});

test("two golfers each save a card, and neither can see the other's", async ({ browser }) => {
  // 1. Each golfer saves a card with a note only they wrote.
  for (const g of GOLFERS) {
    const page = await signedIn(browser, g.who);
    await page.goto("/clubhouse/rounds/new");
    await page.getByLabel(/Total score for 18 holes/).fill("88");
    await page.getByLabel(/^Note/).fill(g.note);
    await page.getByRole("button", { name: "Save the card" }).click();
    await expect(page).toHaveURL(/\/clubhouse\/rounds\/[a-z0-9]+$/);
    await expect(page.getByText("Couldn't save")).toHaveCount(0);
    await page.waitForTimeout(2000); // the sync is debounced (~0.5s); give it time to reach Supabase
    await page.context().close();
  }

  // 2. Each golfer, in a brand-new browser (nothing cached), opens Cards.
  for (const [i, g] of GOLFERS.entries()) {
    const other = GOLFERS[1 - i];
    const page = await signedIn(browser, g.who);
    await page.goto("/clubhouse/rounds");
    await expect(page.getByText(g.note), `${g.who} should see their own card`).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(other.note), `${g.who} must NOT see ${other.who}'s card`).toHaveCount(0);
    await page.context().close();
  }
});
