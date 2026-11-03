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

// ───────── A5: followed players ─────────
// The follows go through the same door as the live pages: the Data API with the publishable key plus the golfer's own
// Clerk token (what src/lib/live/browser.ts sends). The app never filters by user_id, so only RLS can keep golfer-b's
// follows away from golfer-a: these checks fail if any followed_players policy is loosened.
type Golfer = { page: Page; token: string; userId: string };

async function golferToken(browser: Browser, who: string): Promise<Golfer> {
  const page = await signedIn(browser, who);
  const { token, userId } = await page.evaluate(async () => {
    const c = (window as unknown as { Clerk: { session: { getToken(): Promise<string | null> }; user: { id: string } } }).Clerk;
    return { token: (await c.session.getToken()) ?? "", userId: c.user.id };
  });
  expect(token, `${who} should have a Clerk session token`).not.toBe("");
  return { page, token, userId };
}

const rest = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL!}/rest/v1/${path}`;
const headers = (token?: string, extra: Record<string, string> = {}) => ({
  apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...extra,
});

test("golfer-a can't read, delete, or forge golfer-b's followed players", async ({ browser, request }) => {
  const key = `rls-test-${RUN}`; // a key no real player has, so the test never touches real follows
  const b = await golferToken(browser, "golfer-b");

  // 1. golfer-b follows a player (user_id is filled in by the database from b's token).
  const add = await request.post(rest("followed_players"), {
    headers: headers(b.token, { "Content-Type": "application/json", Prefer: "return=minimal" }),
    data: { player_key: key, name: "RLS Test Player" },
  });
  expect(add.status(), "golfer-b should be able to follow a player").toBe(201);

  const a = await golferToken(browser, "golfer-a");
  try {
    // 2. golfer-a reads everything RLS allows: b's follow must not be there.
    const all = await request.get(rest("followed_players?select=player_key,user_id"), { headers: headers(a.token) });
    expect(all.ok()).toBe(true);
    const rows = (await all.json()) as { player_key: string; user_id: string }[];
    expect(rows.filter((r) => r.player_key === key), "golfer-a must NOT see golfer-b's follow").toEqual([]);
    expect(rows.every((r) => r.user_id === a.userId), "every follow golfer-a sees is golfer-a's own").toBe(true);

    // 3. golfer-a tries to delete it: RLS hides the row, so nothing is deleted.
    const del = await request.delete(rest(`followed_players?player_key=eq.${key}`), { headers: headers(a.token, { Prefer: "return=representation" }) });
    expect(await del.json(), "golfer-a's delete must remove nothing").toEqual([]);

    // 4. golfer-a tries to insert a follow in golfer-b's name: the insert policy refuses it.
    const forged = await request.post(rest("followed_players"), {
      headers: headers(a.token, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      data: { user_id: b.userId, player_key: `${key}-forged`, name: "Forged" },
    });
    expect(forged.ok(), `forged insert returned ${forged.status()}`).toBe(false);

    // 5. golfer-b still has exactly the follow they made.
    const mine = await request.get(rest(`followed_players?select=player_key&player_key=like.${key}*`), { headers: headers(b.token) });
    expect(await mine.json(), "golfer-b's follow survives golfer-a's delete").toEqual([{ player_key: key }]);

    // 6. Signed out (publishable key, no token): nothing at all.
    const anon = await request.get(rest("followed_players?select=player_key"), { headers: headers() });
    expect(anon.ok() ? await anon.json() : [], `anon read returned ${anon.status()}`).toEqual([]);
  } finally {
    // Clean up with b's own token (only b can).
    await request.delete(rest(`followed_players?player_key=eq.${key}`), { headers: headers(b.token) });
    await a.page.context().close();
    await b.page.context().close();
  }
});

// ───────── A5: followed airports ─────────
// The same four checks for followed_airports. Its airport column references public.airports, so the test can't
// invent a code: it uses a real one golfer-b doesn't already follow, and removes it again at the end.
test("golfer-a can't read, delete, or forge golfer-b's followed airports", async ({ browser, request }) => {
  const b = await golferToken(browser, "golfer-b");
  const before = await request.get(rest("followed_airports?select=airport"), { headers: headers(b.token) });
  const bHas = new Set(((await before.json()) as { airport: string }[]).map((r) => r.airport));
  const [code, forgedCode] = ["INV", "BQK", "SAV", "MRY", "HHH", "CHS"].filter((c) => !bHas.has(c));
  expect(forgedCode, "two test airports golfer-b doesn't follow").toBeTruthy();

  // 1. golfer-b follows an airport (user_id is filled in by the database from b's token).
  const add = await request.post(rest("followed_airports"), {
    headers: headers(b.token, { "Content-Type": "application/json", Prefer: "return=minimal" }),
    data: { airport: code },
  });
  expect(add.status(), "golfer-b should be able to follow an airport").toBe(201);

  const a = await golferToken(browser, "golfer-a");
  try {
    // 2. golfer-a reads everything RLS allows: only golfer-a's own rows, never b's.
    const all = await request.get(rest("followed_airports?select=airport,user_id"), { headers: headers(a.token) });
    expect(all.ok()).toBe(true);
    const rows = (await all.json()) as { airport: string; user_id: string }[];
    expect(rows.filter((r) => r.user_id === b.userId), "golfer-a must NOT see golfer-b's airports").toEqual([]);
    expect(rows.every((r) => r.user_id === a.userId), "every airport golfer-a sees is golfer-a's own").toBe(true);

    // 3. golfer-a tries to delete b's follow: RLS hides the row, so nothing of b's is deleted.
    const del = await request.delete(rest(`followed_airports?airport=eq.${code}&user_id=eq.${b.userId}`), { headers: headers(a.token, { Prefer: "return=representation" }) });
    expect(await del.json(), "golfer-a's delete must remove nothing").toEqual([]);

    // 4. golfer-a tries to insert a follow in golfer-b's name: the insert policy refuses it.
    const forged = await request.post(rest("followed_airports"), {
      headers: headers(a.token, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      data: { user_id: b.userId, airport: forgedCode },
    });
    expect(forged.ok(), `forged insert returned ${forged.status()}`).toBe(false);

    // 5. golfer-b still has the follow they made, and nothing forged.
    const mine = await request.get(rest(`followed_airports?select=airport&airport=in.(${code},${forgedCode})`), { headers: headers(b.token) });
    expect(await mine.json(), "golfer-b's follow survives, and the forged one doesn't exist").toEqual([{ airport: code }]);

    // 6. Signed out (publishable key, no token): nothing at all.
    const anon = await request.get(rest("followed_airports?select=airport"), { headers: headers() });
    expect(anon.ok() ? await anon.json() : [], `anon read returned ${anon.status()}`).toEqual([]);
  } finally {
    // Clean up with b's own token: only the rows this test made.
    await request.delete(rest(`followed_airports?airport=in.(${code},${forgedCode})`), { headers: headers(b.token) });
    await a.page.context().close();
    await b.page.context().close();
  }
});

// ───────── A5: trips ─────────
// One trip per golfer (user_id is the primary key). golfer-b's real trip is left as it was: if b has none, the test
// makes one and removes it at the end. golfer-a must not read it, change it, delete it, or write one in b's name.
test("golfer-a can't read, change, delete, or forge golfer-b's trip", async ({ browser, request }) => {
  type TripRow = { user_id: string; from_airport: string; to_airport: string; dest_label: string | null };
  const b = await golferToken(browser, "golfer-b");
  const cols = "user_id,from_airport,to_airport,dest_label";
  const own = async (token: string) => (await (await request.get(rest(`trips?select=${cols}`), { headers: headers(token) })).json()) as TripRow[];

  let bTrip = (await own(b.token))[0];
  const made = !bTrip;
  if (made) {
    // 1. golfer-b plans a trip (user_id comes from b's token).
    const add = await request.post(rest("trips"), {
      headers: headers(b.token, { "Content-Type": "application/json", Prefer: "return=representation" }),
      data: { from_airport: "ORD", to_airport: "SAN", dest_label: "RLS test" },
    });
    expect(add.status(), "golfer-b should be able to plan a trip").toBe(201);
    bTrip = ((await add.json()) as TripRow[])[0];
  }

  const a = await golferToken(browser, "golfer-a");
  try {
    // 2. golfer-a reads every trip RLS allows: only their own.
    const rows = await own(a.token);
    expect(rows.filter((r) => r.user_id === b.userId), "golfer-a must NOT see golfer-b's trip").toEqual([]);
    expect(rows.every((r) => r.user_id === a.userId), "every trip golfer-a sees is golfer-a's own").toBe(true);

    // 3. golfer-a tries to change b's trip: RLS hides the row, so nothing is updated.
    const upd = await request.patch(rest(`trips?user_id=eq.${b.userId}`), {
      headers: headers(a.token, { "Content-Type": "application/json", Prefer: "return=representation" }),
      data: { to_airport: "LAX", dest_label: "Hijacked" },
    });
    expect(upd.ok() ? await upd.json() : [], "golfer-a's update must change nothing").toEqual([]);

    // 4. golfer-a tries to delete it: nothing is deleted.
    const del = await request.delete(rest(`trips?user_id=eq.${b.userId}`), { headers: headers(a.token, { Prefer: "return=representation" }) });
    expect(await del.json(), "golfer-a's delete must remove nothing").toEqual([]);

    // 5. golfer-a tries to write a trip in b's name, as an insert and as an upsert: both refused.
    for (const prefer of ["return=minimal", "resolution=merge-duplicates,return=minimal"]) {
      const forged = await request.post(rest("trips?on_conflict=user_id"), {
        headers: headers(a.token, { "Content-Type": "application/json", Prefer: prefer }),
        data: { user_id: b.userId, from_airport: "JFK", to_airport: "LAX", dest_label: "Forged" },
      });
      expect(forged.ok(), `forged write (${prefer}) returned ${forged.status()}`).toBe(false);
    }

    // 6. golfer-b's trip is exactly as it was.
    expect(await own(b.token), "golfer-b's trip is untouched").toEqual([bTrip]);

    // 7. Signed out: nothing.
    const anon = await request.get(rest("trips?select=user_id"), { headers: headers() });
    expect(anon.ok() ? await anon.json() : [], `anon read returned ${anon.status()}`).toEqual([]);
  } finally {
    if (made) await request.delete(rest("trips?dest_label=eq.RLS%20test"), { headers: headers(b.token) });
    await a.page.context().close();
    await b.page.context().close();
  }
});
