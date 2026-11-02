// playerKey is the only thing joining ESPN's leaderboard to OWGR's ranking (they use different player IDs),
// and the app and the worker each have a copy. These tests pin its rules and prove the copies agree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { playerKey } from "../_shared/keys.ts";
import { playerKey as appPlayerKey } from "../../../src/lib/live/playerKey.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

// The documented shape: lowercase, words joined by single dashes. If this changes, every saved follow breaks.
test("plain names become lowercase dash-joined keys", () => {
  assert.equal(playerKey("Scottie Scheffler"), "scottie-scheffler");
  assert.equal(playerKey("Si Woo Kim"), "si-woo-kim");
});

// ESPN and OWGR don't agree on accents; the key must be the same either way, including letters NFKD can't split (ø).
test("accents and special letters fold to plain ASCII", () => {
  assert.equal(playerKey("Ludvig Åberg"), "ludvig-aberg");
  assert.equal(playerKey("Rasmus Højgaard"), "rasmus-hojgaard");
  assert.equal(playerKey("Thorbjørn Olesen"), playerKey("Thorbjorn Olesen"));
  assert.equal(playerKey("José María Olazábal"), "jose-maria-olazabal");
});

// Punctuation, double spaces and stray edges must not create different keys for the same person.
test("punctuation and spacing collapse to single dashes with no edge dashes", () => {
  assert.equal(playerKey("J.J. Spaun"), "j-j-spaun");
  assert.equal(playerKey("  Sean  O'Hair "), "sean-o-hair");
  assert.equal(playerKey("Sean O’Hair"), playerKey("Sean O'Hair"));
  assert.equal(playerKey("Davis Love III"), "davis-love-iii");
});

// The database requires 1-80 characters; an all-punctuation name gives "" (callers skip it) and long names are cut cleanly.
test("empty and very long names stay inside the database's limits", () => {
  assert.equal(playerKey("..."), "");
  assert.equal(playerKey(""), "");
  const long = playerKey("Abcdefghij ".repeat(12));
  assert.ok(long.length <= 80, `length ${long.length}`);
  assert.ok(!long.endsWith("-"));
});

// The point of the key: players in both saved responses (ESPN Mexico Open final, OWGR top 50) must join.
test("the saved ESPN leaderboard and OWGR ranking join on playerKey", () => {
  const espn = fixture("espn-leaderboard-mexico-open-final.json");
  const owgr = fixture("owgr-rankings-top50.json");
  const field = new Set<string>(espn.events[0].competitions[0].competitors.map((c: { athlete: { displayName: string } }) => playerKey(c.athlete.displayName)));
  const joined = owgr.rankingsList.map((r: { player: { fullName: string } }) => r.player.fullName).filter((n: string) => field.has(playerKey(n)));
  assert.ok(joined.includes("Wyndham Clark"), `joined: ${joined.join(", ")}`);
  assert.ok(joined.length >= 3, `only ${joined.length} joined`);
});

// The app (follow buttons) and the worker (leaderboard rows) must produce the same key, or "Your players" stays empty.
test("the app's copy and the worker's playerKey agree on every saved name", () => {
  const espn = fixture("espn-leaderboard-mexico-open-final.json");
  const owgr = fixture("owgr-rankings-top50.json");
  const names: string[] = [
    ...espn.events[0].competitions[0].competitors.map((c: { athlete: { displayName: string } }) => c.athlete.displayName),
    ...owgr.rankingsList.map((r: { player: { fullName: string } }) => r.player.fullName),
    "Ludvig Åberg", "Thorbjørn Olesen", "Sean O’Hair", "...", "", "Abcdefghij ".repeat(12),
  ];
  for (const n of names) assert.equal(appPlayerKey(n), playerKey(n), n);
});
