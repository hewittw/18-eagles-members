"use client";
// Round lifecycle: start, score, finish, delete (with undo), and log a past round.
import type { Course } from "./course-types";
import { holesFor } from "./courses";
import { emptyEntry, newId, todayISO, update } from "./store";
import type { HoleEntry, Nine, Round, RoundWeather, Store } from "./types";

export function activeRound(s: Store): Round | null {
  return [...s.rounds].filter((r) => r.status === "playing").sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

/**
 * Start a live round and remember the tees for this course. Returns the new round id. Only one round is in progress:
 * the new one is what Resume opens. An unfinished round with no scores yet is dropped (nothing to lose); one with
 * scores stays saved and is listed under "Unfinished" on Cards, where it can still be resumed or deleted.
 */
export function startRound(course: Course, teeName: string, nine: Nine): string {
  const id = newId();
  const first = holesFor(course, nine)[0].n;
  update((s) => ({
    ...s,
    rounds: [...s.rounds.filter((r) => r.status !== "playing" || Object.values(r.entries).some((e) => e.strokes != null)), { id, courseSlug: course.slug, teeName, date: todayISO(), holes: nine, mode: "live", status: "playing", entries: {}, totalOnly: null, lastHole: first, note: "", createdAt: Date.now(), finishedAt: null }],
    profile: { ...s.profile, lastTee: { ...s.profile.lastTee, [course.slug]: teeName }, homeCourse: s.profile.homeCourse ?? course.slug },
  }));
  return id;
}

/** Keep the conditions a live round was played in (from /api/weather), once: the first reading wins. */
export function captureWeather(id: string, weather: RoundWeather) {
  update((s) => (s.rounds.some((r) => r.id === id && !r.weather) ? { ...s, rounds: s.rounds.map((r) => (r.id === id && !r.weather ? { ...r, weather } : r)) } : s));
}

export function finishRound(id: string, note?: string) {
  update((s) => ({ ...s, rounds: s.rounds.map((r) => (r.id === id ? { ...r, status: "complete", finishedAt: Date.now(), note: note ?? r.note } : r)) }));
}

export function setRoundNote(id: string, note: string) {
  update((s) => ({ ...s, rounds: s.rounds.map((r) => (r.id === id ? { ...r, note } : r)) }));
}

/** Delete, returning an undo function (the toast's action). */
export function deleteRound(id: string): () => void {
  let removed: Round | undefined;
  let at = -1;
  update((s) => {
    at = s.rounds.findIndex((r) => r.id === id);
    removed = s.rounds[at];
    return { ...s, rounds: s.rounds.filter((r) => r.id !== id) };
  });
  return () => {
    if (!removed) return;
    const r = removed;
    update((s) => {
      const rounds = [...s.rounds];
      rounds.splice(Math.min(at, rounds.length), 0, r);
      return { ...s, rounds };
    });
  };
}

/** Log a round already played: as a total, or hole by hole. Returns the id. */
export function logPastRound(input: { course: Course; teeName: string; date: string; nine: Nine; total: number | null; strokes: Record<number, number> | null; note: string }): string {
  const id = newId();
  const entries: Record<number, HoleEntry> = {};
  if (input.strokes) for (const [n, v] of Object.entries(input.strokes)) entries[Number(n)] = { ...emptyEntry(), strokes: v };
  const holes = holesFor(input.course, input.nine);
  update((s) => ({
    ...s,
    rounds: [...s.rounds.filter((r) => r.status !== "playing" || Object.values(r.entries).some((e) => e.strokes != null)), { id, courseSlug: input.course.slug, teeName: input.teeName, date: input.date, holes: input.nine, mode: "logged", status: "complete", entries, totalOnly: input.strokes ? null : input.total, lastHole: holes[holes.length - 1].n, note: input.note, createdAt: Date.now(), finishedAt: Date.now() }],
    profile: { ...s.profile, lastTee: { ...s.profile.lastTee, [input.course.slug]: input.teeName }, homeCourse: s.profile.homeCourse ?? input.course.slug },
  }));
  return id;
}

/** The first hole of the round with no score yet (where "Resume" goes). */
export function nextUnplayed(r: Round, course: Course): number {
  const hs = holesFor(course, r.holes);
  return hs.find((h) => r.entries[h.n]?.strokes == null)?.n ?? r.lastHole;
}
