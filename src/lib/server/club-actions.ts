"use server";
// Server Actions: the only door between the browser and the golfer's saved journal.
// Each one: (1) Clerk `auth()` (inside supabaseForUser), (2) a Supabase client carrying that user's token,
// (3) RLS in Postgres decides which rows exist for them. Reads deliberately have no `.eq("user_id", …)`
// filter: RLS is the single gatekeeper, and the two-user Playwright test proves it.
import type { Course } from "../course-types";
import type { Club, Goal, HoleEntry, Nine, Profile, Round, RoundWeather, Store } from "../types";
import { httpUrl } from "../safe-url";
import { supabaseForUser } from "./supabase";

type ProfileRow = {
  name: string | null; entered_index: number | null; goal: Goal | null; home_course: string | null;
  last_tee: Record<string, string>; bag: Club[]; honors_seen: string[];
  welcomed_at: number | null; bag_set_at: number | null; last_visit: number | null;
};
type RoundRow = {
  id: string; course_slug: string; tee_name: string; played_on: string; holes: Nine; mode: Round["mode"];
  status: Round["status"]; entries: Record<number, HoleEntry>; total_only: number | null; last_hole: number;
  note: string; created_at: number; finished_at: number | null; weather: RoundWeather | null;
};

export type Loaded = Pick<Store, "profile" | "bag" | "rounds" | "customCourses" | "honorsSeen" | "lastVisit"> & { hasProfile: boolean };

/** Everything this golfer has saved. Called once when the Clubhouse opens. */
export async function loadClub(): Promise<Loaded> {
  const { db } = await supabaseForUser();
  const [p, r, c] = await Promise.all([
    db.from("profiles").select("*").maybeSingle<ProfileRow>(),
    db.from("rounds").select("*").order("played_on", { ascending: true }).returns<RoundRow[]>(),
    db.from("custom_courses").select("course").returns<{ course: Course }[]>(),
  ]);
  const err = p.error ?? r.error ?? c.error;
  if (err) throw new Error(`Couldn't load your locker (${err.code ?? "db"}).`);
  const row = p.data;
  const profile: Profile = {
    name: row?.name ?? null, enteredIndex: row?.entered_index == null ? null : Number(row.entered_index),
    goal: row?.goal ?? null, homeCourse: row?.home_course ?? null, lastTee: row?.last_tee ?? {},
    welcomedAt: row?.welcomed_at == null ? null : Number(row.welcomed_at), bagSetAt: row?.bag_set_at == null ? null : Number(row.bag_set_at),
  };
  return {
    hasProfile: !!row,
    profile,
    bag: row?.bag ?? [],
    honorsSeen: row?.honors_seen ?? [],
    lastVisit: row?.last_visit == null ? null : Number(row.last_visit),
    rounds: (r.data ?? []).map(fromRow),
    customCourses: (c.data ?? []).map((x) => x.course),
  };
}

export type SyncPayload = {
  profile?: { profile: Profile; bag: Club[]; honorsSeen: string[]; lastVisit: number | null };
  upsertRounds?: Round[];
  deleteRounds?: string[];
  upsertCourses?: Course[];
  deleteCourses?: string[];
};

/** Writes one batch of changes (debounced in the browser). Throws on any failure so the app shows "Couldn't save". */
export async function syncClub(change: SyncPayload): Promise<{ ok: true }> {
  const { userId, db } = await supabaseForUser();
  // Defense in depth (security review): reject malformed rounds here with a clear error, before Postgres's own
  // check constraints would, and keep only http(s) links inside a custom course so none can become a javascript: link.
  for (const r of change.upsertRounds ?? []) {
    if (!HOLES.has(r.holes) || !MODES.has(r.mode) || !STATUSES.has(r.status) || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) {
      throw new Error("Couldn't save (that card isn't valid).");
    }
  }
  if (change.profile && change.profile.profile.goal != null && !GOALS.has(change.profile.profile.goal)) throw new Error("Couldn't save (that goal isn't valid).");
  if (change.upsertCourses) change.upsertCourses = change.upsertCourses.map(cleanCourse);
  const tasks: PromiseLike<{ error: { code?: string; message: string } | null }>[] = [];

  if (change.profile) {
    const { profile: p, bag, honorsSeen, lastVisit } = change.profile;
    tasks.push(db.from("profiles").upsert({
      user_id: userId, name: str(p.name, 40), entered_index: num(p.enteredIndex), goal: p.goal, home_course: str(p.homeCourse, 80),
      last_tee: p.lastTee ?? {}, bag: Array.isArray(bag) ? bag : [], honors_seen: Array.isArray(honorsSeen) ? honorsSeen.map(String).slice(0, 200) : [],
      welcomed_at: num(p.welcomedAt), bag_set_at: num(p.bagSetAt), last_visit: num(lastVisit), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }));
  }
  if (change.upsertRounds?.length) {
    tasks.push(db.from("rounds").upsert(change.upsertRounds.slice(0, 500).map((r) => ({ user_id: userId, ...toRow(r), updated_at: new Date().toISOString() })), { onConflict: "user_id,id" }));
  }
  if (change.deleteRounds?.length) tasks.push(db.from("rounds").delete().in("id", change.deleteRounds.map(String).slice(0, 500)));
  if (change.upsertCourses?.length) {
    tasks.push(db.from("custom_courses").upsert(change.upsertCourses.slice(0, 100).map((c) => ({ user_id: userId, slug: String(c.slug), course: c, updated_at: new Date().toISOString() })), { onConflict: "user_id,slug" }));
  }
  if (change.deleteCourses?.length) tasks.push(db.from("custom_courses").delete().in("slug", change.deleteCourses.map(String).slice(0, 100)));

  const results = await Promise.all(tasks);
  const failed = results.find((x) => x.error);
  if (failed?.error) throw new Error(`Couldn't save (${failed.error.code ?? "db"}).`);
  return { ok: true };
}

const HOLES = new Set(["18", "front", "back"]);
const MODES = new Set(["live", "logged"]);
const STATUSES = new Set(["playing", "complete"]);
const GOALS = new Set(["100", "90", "80", "scratch"]);

function cleanCourse(c: Course): Course {
  const img = <T extends { sourceUrl: string } | null>(i: T): T => (i ? { ...i, sourceUrl: httpUrl(i.sourceUrl) ?? "" } : i);
  return {
    ...c,
    sources: Array.isArray(c.sources) ? c.sources.map(httpUrl).filter((u): u is string => !!u) : [],
    hero: img(c.hero),
    gallery: Array.isArray(c.gallery) ? c.gallery.map(img) : [],
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function toRow(r: Round): RoundRow {
  return {
    id: String(r.id), course_slug: String(r.courseSlug), tee_name: String(r.teeName), played_on: String(r.date), holes: r.holes,
    mode: r.mode, status: r.status, entries: r.entries ?? {}, total_only: num(r.totalOnly), last_hole: num(r.lastHole) ?? 1,
    note: typeof r.note === "string" ? r.note : "", created_at: num(r.createdAt) ?? Date.now(), finished_at: num(r.finishedAt),
    weather: r.weather && typeof r.weather === "object" ? r.weather : null,
  };
}
function fromRow(x: RoundRow): Round {
  return {
    id: x.id, courseSlug: x.course_slug, teeName: x.tee_name, date: x.played_on, holes: x.holes, mode: x.mode, status: x.status,
    entries: x.entries ?? {}, totalOnly: x.total_only, lastHole: x.last_hole, note: x.note,
    createdAt: Number(x.created_at), finishedAt: x.finished_at == null ? null : Number(x.finished_at),
    weather: x.weather ?? null,
  };
}
