// poll-tour's pure half (parse.ts) on the saved real responses: the ESPN leaderboard for the 2026 Mexico Open
// (final) and the OWGR top 50. If ESPN or OWGR rename a field, these fail before the page silently goes blank.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEADERBOARD_FIELDS,
  parseLeaderboard,
  parseRankings,
  RANKING_FIELDS,
  shouldFetchLeaderboard,
  type LeaderboardRow,
} from "../poll-tour/parse.ts";
import { diffRows } from "../_shared/diff.ts";
import { playerKey } from "../_shared/keys.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const ESPN = fixture("espn-leaderboard-mexico-open-final.json");
const OWGR = fixture("owgr-rankings-top50.json");

// ───────── ESPN leaderboard ─────────

// The event header the page shows: id, name, course, round, and the "post"/Final state the freshness rules key on.
test("ESPN: the event's fields come through", () => {
  const { event } = parseLeaderboard(ESPN);
  assert.ok(event);
  assert.equal(event.id, "401850978");
  assert.equal(event.name, "VidantaWorld Mexico Open");
  assert.equal(event.state, "post");
  assert.equal(event.status_detail, "Final");
  assert.equal(event.round, 4);
  assert.equal(event.course, "Vidanta Vallarta");
  assert.equal(event.starts_at, "2026-10-29T04:00:00.000Z");
});

// Every one of the 120 competitors becomes exactly one row with a valid key (the database requires 1-80 chars).
test("ESPN: one row per player, each with a valid player_key", () => {
  const { rows } = parseLeaderboard(ESPN);
  assert.equal(rows.length, 120);
  assert.equal(new Set(rows.map((r) => r.player_key)).size, 120);
  for (const r of rows) assert.match(r.player_key, /^[a-z]+(-[a-z]+)*$/);
});

// The leader as the board shows him: Andrew Novak won at -25, position 1, round done.
test("ESPN: the winner is Andrew Novak at -25", () => {
  const { rows } = parseLeaderboard(ESPN);
  const lead = [...rows].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))[0];
  assert.equal(lead.name, "Andrew Novak");
  assert.equal(lead.player_key, "andrew-novak");
  assert.equal(lead.position, "1");
  assert.equal(lead.to_par, "-25");
  assert.equal(lead.today, "-2");
  assert.equal(lead.thru, "F");
  assert.equal(lead.status, "finished");
});

// Ties keep ESPN's "T" prefix, so two players on -20 both read "T2".
test("ESPN: tied players share a T-position", () => {
  const { rows } = parseLeaderboard(ESPN);
  const t2 = rows.filter((r) => r.position === "T2").map((r) => r.name).sort();
  assert.deepEqual(t2, ["Kristoffer Ventura", "Steven Fisk"]);
});

// Cut players have no position or today (they didn't play the weekend) but keep their 36-hole score.
test("ESPN: a cut player has status cut, no position, no today, and keeps their score", () => {
  const { rows } = parseLeaderboard(ESPN);
  const cut = rows.filter((r) => r.status === "cut");
  assert.equal(cut.length, 51);
  const zach = rows.find((r) => r.name === "Zach Bauchou")!;
  assert.deepEqual({ status: zach.status, position: zach.position, today: zach.today, thru: zach.thru, to_par: zach.to_par }, { status: "cut", position: null, today: null, thru: null, to_par: "-2" });
});

// Billy Horschel withdrew before a shot: ESPN says "E" with every round "-". That's no score, not even par.
test("ESPN: a withdrawn player is wd with no score", () => {
  const { rows } = parseLeaderboard(ESPN);
  const wd = rows.filter((r) => r.status === "wd");
  assert.deepEqual(wd.map((r) => r.name), ["Billy Horschel"]);
  assert.equal(wd[0].to_par, null);
  assert.equal(wd[0].position, null);
});

// A week with no tournament: ESPN sends an empty events list. That's a normal state, not an error.
test("ESPN: no event this week gives no event and no rows, without throwing", () => {
  assert.deepEqual(parseLeaderboard({ events: [] }), { event: null, rows: [] });
});

// A changed API (no events list at all) must throw, so the run is recorded ok=false and the page says "down".
test("ESPN: a response without an events list throws", () => {
  assert.throws(() => parseLeaderboard({ sports: [] }), /no events list/);
  assert.throws(() => parseLeaderboard(null), /no events list/);
});

// Live and pre-round shapes (not in the final fixture): a player mid-round shows holes played; one who hasn't teed
// off shows their tee time (ISO) in thru and no today; the event state is "in".
test("ESPN: mid-round and not-yet-started players (live shape)", () => {
  const live = structuredClone(ESPN);
  const comp = live.events[0].competitions[0];
  comp.status = { period: 2, type: { name: "STATUS_IN_PROGRESS", state: "in", detail: "Round 2 - In Progress" } };
  const [a, b] = comp.competitors;
  a.status = { period: 2, displayValue: "7", thru: 7, displayThru: "7", type: { name: "STATUS_IN_PROGRESS", state: "in", shortDetail: "7" }, position: { displayName: "T5" } };
  a.linescores = [{ period: 1, displayValue: "-3" }, { period: 2, displayValue: "-1" }];
  a.score = { displayValue: "-4" };
  b.status = { period: 2, displayValue: "1:16 PM", teeTime: "2026-10-30T18:16Z", type: { name: "STATUS_SCHEDULED", state: "pre" }, position: { displayName: "T40" } };
  b.linescores = [{ period: 1, displayValue: "E" }];
  b.score = { displayValue: "E" };

  const { event, rows } = parseLeaderboard(live);
  assert.equal(event!.state, "in");
  assert.equal(event!.round, 2);
  const ra = rows.find((r) => r.name === a.athlete.displayName)!;
  assert.deepEqual({ s: ra.status, pos: ra.position, toPar: ra.to_par, today: ra.today, thru: ra.thru }, { s: "playing", pos: "T5", toPar: "-4", today: "-1", thru: "7" });
  const rb = rows.find((r) => r.name === b.athlete.displayName)!;
  assert.deepEqual({ s: rb.status, toPar: rb.to_par, today: rb.today, thru: rb.thru }, { s: "not_started", toPar: "E", today: null, thru: "2026-10-30T18:16:00.000Z" });
});

// ───────── OWGR ─────────

// The world ranking parse: #1 is Scottie Scheffler, every row has a rank, points are rounded to 2 decimals.
test("OWGR: 50 rows, #1 Scottie Scheffler, points rounded", () => {
  const rows = parseRankings(OWGR);
  assert.equal(rows.length, 50);
  assert.deepEqual(rows[0], { player_key: "scottie-scheffler", name: "Scottie Scheffler", country: "United States", rank: 1, prev_rank: 1, points: 16.13 });
  assert.deepEqual(rows.map((r) => r.rank), [...rows.map((r) => r.rank)].sort((x, y) => x - y));
  for (const r of rows) assert.equal(r.points, Math.round((r.points ?? 0) * 100) / 100);
});

// A changed API must throw (run ok=false), not wipe the saved ranking.
test("OWGR: a response without rankingsList throws", () => {
  assert.throws(() => parseRankings({ items: [] }), /no rankingsList/);
});

// ───────── The join ─────────

// "Your players" works only if a name followed from the leaderboard finds the same person in the ranking.
test("playerKey joins an ESPN leaderboard row to its OWGR ranking row", () => {
  const board = new Map(parseLeaderboard(ESPN).rows.map((r) => [r.player_key, r]));
  const ranked = parseRankings(OWGR);
  const both = ranked.filter((r) => board.has(r.player_key));
  assert.ok(both.length >= 3, `only ${both.length} joined`);
  const clark = ranked.find((r) => r.name === "Wyndham Clark")!;
  assert.equal(board.get(clark.player_key)?.name, "Wyndham Clark");
  assert.equal(playerKey("Wyndham Clark"), clark.player_key);
});

// ───────── Diff: only what changed ─────────

// The 10-second tick with nothing new: the same response parsed twice must write nothing (0 Realtime messages).
test("diff: the same ESPN response twice gives 0 upserts and 0 deletes", () => {
  const first = parseLeaderboard(ESPN).rows;
  const again = parseLeaderboard(structuredClone(ESPN)).rows;
  const d = diffRows<LeaderboardRow, "event_id" | "player_key">(first, again, ["event_id", "player_key"], LEADERBOARD_FIELDS);
  assert.deepEqual(d, { upserts: [], deletes: [] });
});

// One score changes and one player drops off the feed: exactly that one row is upserted and that one deleted.
test("diff: one changed score and one removed player give exactly 1 upsert and 1 delete", () => {
  const saved = parseLeaderboard(ESPN).rows;
  const next = structuredClone(ESPN);
  const comps = next.events[0].competitions[0].competitors;
  const novak = comps.find((c: { athlete: { displayName: string } }) => c.athlete.displayName === "Andrew Novak");
  novak.score.displayValue = "-26";
  const gone = comps.findIndex((c: { athlete: { displayName: string } }) => c.athlete.displayName === "Billy Horschel");
  comps.splice(gone, 1);

  const d = diffRows<LeaderboardRow, "event_id" | "player_key">(saved, parseLeaderboard(next).rows, ["event_id", "player_key"], LEADERBOARD_FIELDS);
  assert.deepEqual(d.upserts.map((r) => [r.player_key, r.to_par]), [["andrew-novak", "-26"]]);
  assert.deepEqual(d.deletes, [{ event_id: "401850978", player_key: "billy-horschel" }]);
});

// Rankings change weekly; the hourly run on an unchanged ranking must write nothing either.
test("diff: the same OWGR response twice gives 0 upserts", () => {
  const rows = parseRankings(OWGR);
  const d = diffRows(rows, parseRankings(structuredClone(OWGR)), "player_key", RANKING_FIELDS);
  assert.deepEqual(d, { upserts: [], deletes: [] });
});

// ───────── Adaptive polling ─────────

const NOW = new Date("2026-11-05T15:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

// During a live round every 10-second tick calls ESPN, however recent the last call.
test("poll: a live round fetches every tick", () => {
  assert.deepEqual(shouldFetchLeaderboard({ event: { state: "in", starts_at: ago(600) }, lastFetchAt: ago(0.1), now: NOW }), { fetch: true, reason: "live" });
});

// No live round and ESPN was called under 5 minutes ago: record an idle run, don't call ESPN.
test("poll: no live round and a fetch under 5 minutes ago stays idle", () => {
  assert.deepEqual(shouldFetchLeaderboard({ event: { state: "post", starts_at: ago(5000) }, lastFetchAt: ago(4.9), now: NOW }), { fetch: false, reason: "idle" });
});

// No live round, but 5 minutes have passed: one refresh (that's how next week's event shows up).
test("poll: no live round fetches again after 5 minutes", () => {
  assert.equal(shouldFetchLeaderboard({ event: { state: "post", starts_at: ago(5000) }, lastFetchAt: ago(5), now: NOW }).reason, "idle-refresh");
});

// Nothing saved and no fetch on record (a fresh deploy): fetch.
test("poll: the very first run fetches", () => {
  assert.deepEqual(shouldFetchLeaderboard({ event: null, lastFetchAt: null, now: NOW }), { fetch: true, reason: "first" });
});

// Within 30 minutes of the first tee time, poll every tick so the opening scores land at once. The known tee time
// wins over ESPN's event date (midnight ET), which would otherwise mean hours of polling before anyone tees off.
test("poll: within 30 minutes of the first tee time fetches every tick; hours before stays idle", () => {
  const ev = { state: "pre", starts_at: ago(600) };
  assert.equal(shouldFetchLeaderboard({ event: ev, firstTeeAt: ago(-29), lastFetchAt: ago(1), now: NOW }).reason, "near-start");
  assert.equal(shouldFetchLeaderboard({ event: ev, firstTeeAt: ago(-180), lastFetchAt: ago(1), now: NOW }).fetch, false);
  assert.equal(shouldFetchLeaderboard({ event: ev, lastFetchAt: ago(1), now: NOW }).reason, "near-start");
});
