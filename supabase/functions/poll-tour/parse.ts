// poll-tour's pure half: ESPN leaderboard JSON → { event, rows }, OWGR JSON → ranking rows, and the adaptive-poll
// decision. No Deno or npm imports, so the Node tests (supabase/functions/tests/tour*.test.ts) import it directly.
// Every field is read defensively: a missing or renamed field gives null (or skips the row), never a throw.
import { playerKey } from "../_shared/keys.ts";

export type TourEventRow = {
  id: string;
  name: string;
  short_name: string | null;
  state: "pre" | "in" | "post";
  status_detail: string | null;
  round: number | null;
  starts_at: string | null;
  ends_at: string | null;
  course: string | null;
};

export type PlayerStatus = "playing" | "finished" | "not_started" | "cut" | "wd" | "dq" | "mdf";

export type LeaderboardRow = {
  event_id: string;
  player_key: string;
  athlete_id: string | null;
  name: string;
  country: string | null;
  /** "1", "T5", or null (cut, withdrawn, not ranked yet). */
  position: string | null;
  sort_order: number | null;
  /** Total to par as ESPN shows it: "-25", "E", "+3"; null when there's no score (withdrew before a shot). */
  to_par: string | null;
  /** This round to par, or null before the player has started it (and for players out of the event). */
  today: string | null;
  /** Holes played this round ("7"), "F" when the round is done, the tee time as an ISO instant before they start, or null. */
  thru: string | null;
  status: PlayerStatus;
};

export type RankingRow = {
  player_key: string;
  name: string;
  country: string | null;
  rank: number;
  prev_rank: number | null;
  /** OWGR average points, rounded to 2 decimals so float noise never counts as a change. */
  points: number | null;
};

/** The columns diffRows compares (never updated_at, which the worker stamps on each write). */
export const EVENT_FIELDS = ["name", "short_name", "state", "status_detail", "round", "starts_at", "ends_at", "course"] as const;
export const LEADERBOARD_FIELDS = ["athlete_id", "name", "country", "position", "sort_order", "to_par", "today", "thru", "status"] as const;
export const RANKING_FIELDS = ["name", "country", "rank", "prev_rank", "points"] as const;

// ───────── ESPN ─────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
const int = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
/** ESPN writes "2026-10-29T04:00Z"; store a full ISO instant, or null if it isn't a date. */
const iso = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};
/** ESPN uses "-" and "--" for "nothing here". */
const dash = (v: string | null): string | null => (v === null || /^-+$/.test(v) ? null : v);

export type ParsedLeaderboard = { event: TourEventRow | null; rows: LeaderboardRow[] };

/**
 * parseLeaderboard(json) → { event, rows }. The primary PGA TOUR event (or the first one listed), and one row per
 * competitor with a usable name. No event this week (an empty `events`) gives { event: null, rows: [] }.
 * Throws only if the response isn't an object with an `events` array at all (a changed API, so the run is ok=false).
 */
export function parseLeaderboard(json: unknown): ParsedLeaderboard {
  const root = obj(json);
  if (!Array.isArray(root.events)) throw new Error("ESPN response has no events list");
  const events = root.events.map(obj);
  const ev = events.find((e) => e.primary === true) ?? events[0];
  if (!ev) return { event: null, rows: [] };

  const id = str(ev.id);
  const comp = obj(arr(ev.competitions)[0]);
  if (!id) return { event: null, rows: [] };

  const compType = obj(obj(comp.status).type);
  const evType = obj(obj(ev.status).type);
  const rawState = str(compType.state) ?? str(evType.state);
  const state: TourEventRow["state"] = rawState === "in" || rawState === "post" ? rawState : "pre";
  const courses = arr(ev.courses).map(obj);
  const course = courses.find((c) => c.host === true) ?? courses[0];

  const event: TourEventRow = {
    id,
    name: str(ev.name) ?? str(ev.shortName) ?? "PGA TOUR event",
    short_name: str(ev.shortName),
    state,
    status_detail: str(compType.detail) ?? str(evType.description),
    round: int(obj(comp.status).period),
    starts_at: iso(ev.date),
    ends_at: iso(ev.endDate),
    course: course ? str(course.name) : null,
  };

  const rows: LeaderboardRow[] = [];
  for (const raw of arr(comp.competitors)) {
    const row = parseCompetitor(obj(raw), id, event);
    if (row) rows.push(row);
  }
  return { event, rows };
}

function parseCompetitor(c: Obj, eventId: string, event: TourEventRow): LeaderboardRow | null {
  const athlete = obj(c.athlete);
  const name = str(athlete.displayName) ?? str(athlete.fullName);
  const key = name ? playerKey(name) : "";
  if (!name || !key) return null;

  const st = obj(c.status);
  const type = obj(st.type);
  const status = playerStatus(st, type, event.state);
  const out = status === "cut" || status === "wd" || status === "dq" || status === "mdf";
  const period = int(st.period);

  // Total to par. A withdrawal before any shot shows "E" with every round "-": that's no score, not even par.
  const score = obj(c.score);
  const lines = arr(c.linescores).map(obj);
  const played = lines.some((l) => dash(str(l.displayValue)) !== null);
  let toPar = dash(str(score.displayValue));
  if (!toPar) {
    const stat = arr(c.statistics).map(obj).find((s) => s.name === "scoreToPar");
    toPar = stat ? dash(str(stat.displayValue)) : null;
  }
  // Before a first-round tee shot ESPN says "E"; the board shows nothing yet.
  if (!played && (status === "wd" || status === "dq" || (status === "not_started" && (event.round ?? 1) <= 1))) toPar = null;

  // Today: the current round's score, only while the player is in it (not for a cut player one round behind).
  const current = period !== null ? lines.find((l) => int(l.period) === period) : lines.at(-1);
  const today = out || status === "not_started" || st.behindCurrentRound === true ? null : current ? dash(str(current.displayValue)) : null;

  // Thru: holes played, F, or the tee time (ISO) before they start.
  let thru: string | null = null;
  if (status === "finished") thru = "F";
  else if (status === "playing") thru = str(st.displayThru) ?? str(st.thru);
  else if (status === "not_started") thru = iso(st.teeTime) ?? iso(current?.teeTime);
  if (thru === "18" && status === "playing") thru = "F";

  return {
    event_id: eventId,
    player_key: key,
    athlete_id: str(athlete.id) ?? str(c.id),
    name,
    country: str(obj(athlete.flag).alt),
    position: out ? null : dash(str(obj(st.position).displayName)),
    sort_order: int(c.sortOrder),
    to_par: toPar,
    today,
    thru,
    status,
  };
}

function playerStatus(st: Obj, type: Obj, eventState: TourEventRow["state"]): PlayerStatus {
  const short = (str(type.shortDetail) ?? str(st.displayValue) ?? "").toUpperCase();
  const name = str(type.name) ?? "";
  if (short === "WD" || /withdr/i.test(str(type.description) ?? "")) return "wd";
  if (short === "DQ" || /disqual/i.test(str(type.description) ?? "")) return "dq";
  if (short === "MDF") return "mdf";
  if (short === "CUT" || name === "STATUS_CUT") return "cut";
  if (name === "STATUS_FINISH" || name === "STATUS_PLAY_COMPLETE" || short === "F") return "finished";
  if (name === "STATUS_SCHEDULED" || str(type.state) === "pre") return eventState === "post" ? "finished" : "not_started";
  if (name === "STATUS_IN_PROGRESS" || str(type.state) === "in") return "playing";
  return type.completed === true || eventState === "post" ? "finished" : "playing";
}

// ───────── OWGR ─────────

/**
 * parseRankings(json) → ranking rows, best first. Rows without a name or a rank are skipped; a player listed twice
 * keeps the better rank. Throws only if there's no `rankingsList` array (a changed API).
 */
export function parseRankings(json: unknown): RankingRow[] {
  const root = obj(json);
  if (!Array.isArray(root.rankingsList)) throw new Error("OWGR response has no rankingsList");
  const byKey = new Map<string, RankingRow>();
  for (const raw of root.rankingsList) {
    const r = obj(raw);
    const p = obj(r.player);
    const name = str(p.fullName) ?? ([str(p.firstName), str(p.lastName)].filter(Boolean).join(" ") || null);
    const rank = int(r.rank);
    const key = name ? playerKey(name) : "";
    if (!name || !key || rank === null || rank < 1) continue;
    const avg = typeof r.pointsAverage === "number" && Number.isFinite(r.pointsAverage) ? Math.round(r.pointsAverage * 100) / 100 : null;
    const prev = int(r.lastWeekRank);
    const row: RankingRow = { player_key: key, name, country: str(obj(p.country).name), rank, prev_rank: prev && prev > 0 ? prev : null, points: avg };
    const had = byKey.get(key);
    if (!had || rank < had.rank) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => a.rank - b.rank);
}

// ───────── Adaptive polling ─────────

export const IDLE_REFETCH_MS = 5 * 60 * 1000;
export const NEAR_START_MS = 30 * 60 * 1000;

export type PollDecision = { fetch: boolean; reason: "live" | "near-start" | "first" | "idle-refresh" | "idle" };

/**
 * shouldFetchLeaderboard({ event, lastFetchAt, now }) → { fetch, reason }
 * Cron ticks every 10 s. During a live round (the stored event's state is "in", or its first tee time is within 30 minutes)
 * the worker calls ESPN every tick. Otherwise it calls at most once every 5 minutes, measured from the last real
 * ESPN fetch (ok or failed, so a down source isn't hammered either); in between it records an idle run.
 */
export function shouldFetchLeaderboard(input: {
  event: { state: string | null; starts_at: string | null } | null;
  /** The earliest stored tee time of anyone not started yet, if known. ESPN's event date is midnight ET, hours
   *  before the first tee shot, so the real tee time is the better "start". */
  firstTeeAt?: string | null;
  lastFetchAt: Date | string | null;
  now: Date;
}): PollDecision {
  const now = input.now.getTime();
  const ev = input.event;
  if (ev?.state === "in") return { fetch: true, reason: "live" };
  const tee = input.firstTeeAt ? Date.parse(input.firstTeeAt) : NaN;
  const start = Number.isFinite(tee) ? tee : ev?.starts_at ? Date.parse(ev.starts_at) : NaN;
  if (ev?.state === "pre" && Number.isFinite(start) && now >= start - NEAR_START_MS) return { fetch: true, reason: "near-start" };
  const last = input.lastFetchAt ? new Date(input.lastFetchAt).getTime() : NaN;
  if (!Number.isFinite(last)) return { fetch: true, reason: "first" };
  if (now - last >= IDLE_REFETCH_MS) return { fetch: true, reason: "idle-refresh" };
  return { fetch: false, reason: "idle" };
}
