"use client";
// The golfer's journal in memory, synced to their own rows in Supabase (see "the external store" below).
import { useSyncExternalStore } from "react";
import { loadClub, syncClub, type SyncPayload } from "./server/club-actions";
import type { Club, HoleEntry, Profile, Round, Store } from "./types";


// In the natural order (longest club first within each kind), whether or not a club starts in the bag.
export const DEFAULT_BAG: Club[] = [
  { id: "dr", name: "Driver", short: "Dr", kind: "wood", inBag: true },
  { id: "3w", name: "3-wood", short: "3w", kind: "wood", inBag: true },
  { id: "5w", name: "5-wood", short: "5w", kind: "wood", inBag: true },
  { id: "7w", name: "7-wood", short: "7w", kind: "wood", inBag: false },
  { id: "3h", name: "3-hybrid", short: "3h", kind: "hybrid", inBag: false },
  { id: "4h", name: "4-hybrid", short: "4h", kind: "hybrid", inBag: true },
  { id: "3i", name: "3-iron", short: "3i", kind: "iron", inBag: false },
  { id: "4i", name: "4-iron", short: "4i", kind: "iron", inBag: false },
  { id: "5i", name: "5-iron", short: "5i", kind: "iron", inBag: true },
  { id: "6i", name: "6-iron", short: "6i", kind: "iron", inBag: true },
  { id: "7i", name: "7-iron", short: "7i", kind: "iron", inBag: true },
  { id: "8i", name: "8-iron", short: "8i", kind: "iron", inBag: true },
  { id: "9i", name: "9-iron", short: "9i", kind: "iron", inBag: true },
  { id: "pw", name: "Pitching wedge", short: "PW", kind: "wedge", inBag: true },
  { id: "gw", name: "Gap wedge (50°)", short: "50°", kind: "wedge", inBag: true },
  { id: "sw", name: "Sand wedge (56°)", short: "56°", kind: "wedge", inBag: true },
  { id: "lw", name: "Lob wedge (60°)", short: "60°", kind: "wedge", inBag: true },
  { id: "pt", name: "Putter", short: "Pt", kind: "putter", inBag: true },
];

const CLUB_RANK = new Map(DEFAULT_BAG.map((c, i) => [c.id, i]));
/**
 * Sort comparator for listing clubs in their natural order (Driver … Putter), wherever they're listed. A saved
 * bag keeps the order it was stored in (older bags put the clubs left out last), so sort at display time:
 * `[...bag].sort(byClubOrder)`. Clubs not in the default set keep their place after the known ones.
 */
export function byClubOrder(a: Pick<Club, "id">, b: Pick<Club, "id">) {
  return (CLUB_RANK.get(a.id) ?? DEFAULT_BAG.length) - (CLUB_RANK.get(b.id) ?? DEFAULT_BAG.length);
}

const EMPTY_PROFILE: Profile = { name: null, enteredIndex: null, goal: null, homeCourse: null, lastTee: {}, welcomedAt: null, bagSetAt: null };

export function emptyStore(): Store {
  return { v: 1, profile: { ...EMPTY_PROFILE }, bag: DEFAULT_BAG.map((c) => ({ ...c })), rounds: [], customCourses: [], honorsSeen: [], lastVisit: null };
}

export const emptyEntry = (): HoleEntry => ({ strokes: null, putts: null, fairway: null, penalties: 0, shots: [], note: "" });

// ---------- the external store ----------
// Week 4: the journal lives in Supabase, per Clerk account. The page still reads one in-memory Store through
// useSyncExternalStore (instant updates, the same API every page already uses); every change is diffed against
// the last state the server confirmed and sent in one debounced Server Action (syncClub). Nothing personal is
// kept in localStorage any more, so a shared computer never shows the last golfer's cards.

let cache: Store = emptyStore();
let synced: Store = cache; // what Supabase last confirmed
let ready = false; // false until this account's data has loaded
let owner: string | null = null; // the Clerk user id the cache belongs to
let loadError: string | null = null;
let loading = false;
const listeners = new Set<() => void>();
const notify = () => { clientSnap = null; listeners.forEach((l) => l()); };

/** The signed-in golfer whose journal is in memory (drafts are keyed by it too). */
export const currentOwner = () => owner;

/** Called by <StoreSync> whenever the Clerk user changes: load their journal, or clear it on sign-out. */
export async function hydrateFor(userId: string | null) {
  if (userId === owner && (ready || loading)) return;
  owner = userId;
  cache = synced = emptyStore();
  ready = false;
  loadError = null;
  notify();
  if (!userId) return;
  loading = true;
  try {
    const got = await loadClub();
    if (owner !== userId) return; // signed out or switched while loading
    const base = emptyStore();
    cache = synced = {
      ...base,
      profile: { ...base.profile, ...got.profile },
      bag: got.bag.length ? got.bag : base.bag,
      rounds: got.rounds,
      customCourses: got.customCourses,
      honorsSeen: got.honorsSeen,
      lastVisit: got.lastVisit,
    };
    if (!got.hasProfile) synced = { ...synced, bag: [] }; // first sign-in: the default bag still needs saving
    ready = true;
  } catch {
    if (owner === userId) loadError = "We couldn't open your locker. Check your connection and try again.";
  } finally {
    loading = false;
    notify();
  }
}

export function useLoadError(): string | null {
  return useSyncExternalStore(subscribe, () => loadError, () => null);
}
export function retryLoad() {
  const who = owner;
  owner = null;
  return hydrateFor(who);
}

// A failed save is never silent: the change stays in memory and on screen, the app shows "Couldn't save" with
// Try again (SaveProblem), and the next successful sync clears it.
let saveFailed = false;
let saving = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const saveListeners = new Set<() => void>();
function setSaveFailed(v: boolean) {
  if (v === saveFailed) return;
  saveFailed = v;
  saveListeners.forEach((l) => l());
}

function diff(a: Store, b: Store): SyncPayload | null {
  const out: SyncPayload = {};
  if (a.profile !== b.profile || a.bag !== b.bag || a.honorsSeen !== b.honorsSeen || a.lastVisit !== b.lastVisit) {
    out.profile = { profile: b.profile, bag: b.bag, honorsSeen: b.honorsSeen, lastVisit: b.lastVisit };
  }
  const oldR = new Map(a.rounds.map((r) => [r.id, r]));
  const up = b.rounds.filter((r) => oldR.get(r.id) !== r);
  if (up.length) out.upsertRounds = up;
  const keepR = new Set(b.rounds.map((r) => r.id));
  const del = a.rounds.filter((r) => !keepR.has(r.id)).map((r) => r.id);
  if (del.length) out.deleteRounds = del;
  const oldC = new Map(a.customCourses.map((c) => [c.slug, c]));
  const upC = b.customCourses.filter((c) => oldC.get(c.slug) !== c);
  if (upC.length) out.upsertCourses = upC;
  const keepC = new Set(b.customCourses.map((c) => c.slug));
  const delC = a.customCourses.filter((c) => !keepC.has(c.slug)).map((c) => c.slug);
  if (delC.length) out.deleteCourses = delC;
  return Object.keys(out).length ? out : null;
}

async function flush(): Promise<boolean> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!ready || !owner) return true;
  if (saving) { schedule(); return true; }
  const target = cache;
  const change = diff(synced, target);
  if (!change) { setSaveFailed(false); return true; }
  const who = owner;
  saving = true;
  try {
    await syncClub(change);
    if (who === owner) synced = target;
    setSaveFailed(false);
    return true;
  } catch {
    if (who === owner) setSaveFailed(true);
    return false;
  } finally {
    saving = false;
    if (!saveFailed && cache !== synced) schedule();
  }
}
function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 450);
}

/** True while there are changes on screen that the server hasn't confirmed yet. */
export const hasUnsavedChanges = () => ready && cache !== synced;

function write(next: Store) {
  if (!ready) return; // nothing is editable before the account's data has loaded
  cache = next;
  notify();
  schedule();
}

/** True while the latest change couldn't be saved to the golfer's account. */
export function useSaveFailed(): boolean {
  return useSyncExternalStore(
    (l) => { saveListeners.add(l); return () => { saveListeners.delete(l); }; },
    () => saveFailed,
    () => false,
  );
}

/** Try saving the in-memory changes again. Resolves to whether it worked. */
export function retrySave(): Promise<boolean> {
  return flush();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// The server render can't know who's signed in. `ready: false` lets pages show a quiet placeholder instead of
// flashing the first-visit screen at a returning golfer while their journal loads.
type Snap = { ready: boolean; store: Store };
const SERVER: Snap = { ready: false, store: emptyStore() };
let clientSnap: Snap | null = null;
function getSnapshot(): Snap {
  if (!clientSnap) clientSnap = { ready, store: cache };
  return clientSnap;
}
const read = () => cache;

export function useStore(): Snap {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}

export function update(fn: (s: Store) => Store) {
  write(fn(read()));
}

export function resetAll() {
  write(emptyStore());
}

export function exportJSON(): string {
  return JSON.stringify(read(), null, 2);
}

export function importJSON(text: string): string | null {
  try {
    const s = JSON.parse(text) as Store;
    if (s.v !== 1 || !Array.isArray(s.rounds)) return "That file isn't an 18 Eagles export. Choose a file saved from the Locker.";
    write({ ...emptyStore(), ...s, profile: { ...EMPTY_PROFILE, ...s.profile } });
    return null;
  } catch {
    return "That file couldn't be read. Choose the .json file saved from the Locker.";
  }
}

// ---------- helpers used across pages ----------
export const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function todayISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function upsertRound(r: Round) {
  update((s) => ({ ...s, rounds: s.rounds.some((x) => x.id === r.id) ? s.rounds.map((x) => (x.id === r.id ? r : x)) : [...s.rounds, r] }));
}

export function setEntry(roundId: string, hole: number, patch: Partial<HoleEntry>) {
  update((s) => ({
    ...s,
    rounds: s.rounds.map((r) =>
      r.id !== roundId ? r : { ...r, lastHole: hole, entries: { ...r.entries, [hole]: { ...emptyEntry(), ...r.entries[hole], ...patch } } },
    ),
  }));
}

export function patchProfile(p: Partial<Profile>) {
  update((s) => ({ ...s, profile: { ...s.profile, ...p } }));
}
