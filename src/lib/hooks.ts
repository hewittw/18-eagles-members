"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allCourses, findCourse } from "./courses";
import { computeHandicap } from "./handicap";
import { activeRound } from "./round-actions";
import { currentOwner, useStore } from "./store";

/** Everything most pages need: the saved data, the derived handicap, and any round in progress. */
export function useClub() {
  const { ready, store } = useStore();
  const handicap = useMemo(
    () => computeHandicap(store.rounds, store.customCourses, store.profile.enteredIndex),
    [store.rounds, store.customCourses, store.profile.enteredIndex],
  );
  const active = useMemo(() => activeRound(store), [store]);
  const courses = useMemo(() => allCourses(store.customCourses), [store.customCourses]);
  const course = useCallback((slug: string) => findCourse(slug, store.customCourses), [store.customCourses]);
  return { ready, store, handicap, active, courses, course };
}

/**
 * Form state that survives leaving the page and coming back (a draft in localStorage as you type, per account),
 * so nothing a golfer typed is ever lost. `clear()` after a successful save.
 */
export function useDraft<T>(key: string, initial: T): [T, (next: T | ((p: T) => T)) => void, (opts?: { keepShown?: boolean }) => void, boolean] {
  // Keyed by the signed-in account, so a shared computer never shows one golfer's half-typed form to another.
  const full = `18eagles:draft:${currentOwner() ?? "anon"}:${key}`;
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(full);
      if (raw) {
        // Restoring a saved draft after mount (localStorage isn't readable during the server render).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue({ ...initial, ...JSON.parse(raw) });
        setRestored(true);
      }
    } catch {}
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  const set = useCallback(
    (next: T | ((p: T) => T)) => {
      setValue((p) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(p) : next;
        try { window.localStorage.setItem(full, JSON.stringify(v)); } catch {}
        return v;
      });
    },
    [full],
  );
  // `keepShown`: forget the saved draft but leave the form as it is (while a successful save navigates away).
  const clear = useCallback((opts?: { keepShown?: boolean }) => {
    try { window.localStorage.removeItem(full); } catch {}
    if (opts?.keepShown === true) return;
    setValue(initial);
    setRestored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  return [value, set, clear, restored];
}

/**
 * Call from a tap that navigates (Finish round, Delete, Save the card). A quick double tap's second tap would land on
 * whatever the next page has in that spot (a card row, a tab), so clicks are ignored for a moment.
 */
export function swallowStrayTap(ms = 450) {
  const until = performance.now() + ms;
  const stop = (ev: Event) => {
    if (performance.now() > until) return;
    ev.preventDefault();
    ev.stopPropagation();
  };
  document.addEventListener("click", stop, true);
  window.setTimeout(() => document.removeEventListener("click", stop, true), ms);
}
