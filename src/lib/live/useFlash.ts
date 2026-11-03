"use client";
import { useEffect, useRef } from "react";

/**
 * The live pages' brief highlight: an element a pushed change touched washes Fairway Tint and fades back, once
 * (1.8 s). Nothing under reduced motion, and nothing for a change older than 3 s (a re-render isn't a new change).
 * Shared by Tour (a leaderboard row) and the Pro Shop (a deal card).
 */
export function useFlash<T extends HTMLElement>(at: number | undefined) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!at || !el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (Date.now() - at > 3000) return;
    const tint = getComputedStyle(document.documentElement).getPropertyValue("--color-tint-2").trim() || "#D7E7E0";
    el.animate([{ backgroundColor: tint }, { backgroundColor: "transparent" }], { duration: 1800, easing: "ease-out" });
  }, [at]);
  return ref;
}
