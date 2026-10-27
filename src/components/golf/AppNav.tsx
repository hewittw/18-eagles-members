"use client";
import Link from "next/link";
import type { MouseEvent } from "react";
import { cx } from "../ui/cx";

export type NavKey = "clubhouse" | "courses" | "cards" | "stats" | "locker";

export const NAV: { key: NavKey; label: string; href: string; hint: string }[] = [
  { key: "clubhouse", label: "Clubhouse", href: "/clubhouse", hint: "Home: your index and the next round" },
  { key: "courses", label: "Courses", href: "/clubhouse/courses", hint: "Pick a course and play" },
  { key: "cards", label: "Cards", href: "/clubhouse/rounds", hint: "Every round, kept" },
  { key: "stats", label: "Stats", href: "/clubhouse/stats", hint: "How you play" },
  { key: "locker", label: "Locker", href: "/clubhouse/locker", hint: "Your bag and settings" },
];

/** Drawn line icons, one per tab. No icon font, no emoji. */
export function NavIcon({ k, className }: { k: NavKey; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={cx("size-6", className)} aria-hidden="true">
      {k === "clubhouse" && (<><path {...p} d="M3 11 L12 4 L21 11" /><path {...p} d="M5.5 9.5 V20 H18.5 V9.5" /><path {...p} d="M10 20 V14.5 H14 V20" /><path {...p} d="M12 4 V1.8" /></>)}
      {k === "courses" && (<><path {...p} d="M8 21 V3" /><path d="M8 3.2 L17 6 L8 8.8 Z" fill="currentColor" /><ellipse {...p} cx="10.5" cy="20.6" rx="7.5" ry="1.6" /></>)}
      {k === "cards" && (<><rect {...p} x="3" y="5" width="18" height="14" rx="0.5" /><path {...p} d="M3 9.5 H21 M3 14 H21 M9 5 V19 M15 5 V19" /><circle {...p} cx="12" cy="16.5" r="1.4" /></>)}
      {k === "stats" && (<><path {...p} d="M3 20.5 H21" /><path {...p} d="M5.5 20.5 V12 H9 V20.5 M10.5 20.5 V7 H14 V20.5 M15.5 20.5 V14.5 H19 V20.5" /></>)}
      {k === "locker" && (<><rect {...p} x="5" y="2.5" width="14" height="19" rx="0.5" /><path {...p} d="M8 5.5 H16 M8 7.5 H16 M8 9.5 H16" /><path {...p} d="M15.5 13.5 V16" /></>)}
    </svg>
  );
}

/**
 * Tapping the tab for the page you're already on goes back to its top (as an iOS tab bar does), the same at every size.
 * A sub-page (Log a round under Cards) still navigates to the tab's page.
 */
function toTopIfHere(e: MouseEvent<HTMLAnchorElement>, href: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  if (window.location.pathname.replace(/\/$/, "") !== href) return;
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

export type AppNavProps = {
  current?: NavKey;
  /** bar: the desktop top bar (inline links). tabs: the phone tab bar (icons over labels). */
  variant?: "bar" | "tabs";
  /** The nav landmark's name. */
  label?: string;
  className?: string;
};

/** The tool's five places, in the same order everywhere. The current one gets aria-current="page" and a brass mark. */
export function AppNav({ current, variant = "bar", label = "18 Eagles", className }: AppNavProps) {
  if (variant === "tabs") {
    return (
      <nav aria-label={label} className={className}>
        <ul className="mx-auto grid min-h-[var(--tabbar)] w-full max-w-xl grid-cols-5">
          {NAV.map((n) => {
            const on = current === n.key;
            return (
              <li key={n.key} className="flex min-w-0">
                <Link
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  onClick={(e) => toTopIfHere(e, n.href)}
                  className={cx(
                    "relative flex min-h-tile w-full flex-col items-center justify-center gap-0.5 px-0.5 pb-1 pt-1.5 transition-colors duration-150 -outline-offset-4",
                    on ? "text-green" : "text-ink-2 is-hover:text-ink is-pressed:text-green",
                  )}
                >
                  <span aria-hidden="true" className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors", on ? "bg-tint" : "bg-transparent")}>
                    <NavIcon k={n.key} className={cx("size-[1.35rem]", on && "[&_path]:stroke-[1.9]")} />
                  </span>
                  <span className={cx("max-w-full text-center text-[0.68rem] leading-tight tracking-[0.01em] [overflow-wrap:anywhere]", on ? "font-bold" : "font-medium")}>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label={label} className={cx("on-green", className)}>
      <ul className="flex flex-wrap items-stretch justify-end gap-x-1">
        {NAV.map((n) => {
          const on = current === n.key;
          return (
            <li key={n.key}>
              <Link
                href={n.href}
                aria-current={on ? "page" : undefined}
                onClick={(e) => toTopIfHere(e, n.href)}
                className={cx(
                  "caps relative flex min-h-tap items-center gap-2 px-2.5 condensed:gap-0 text-[0.85rem] tracking-[0.14em] transition-[color,gap] duration-200 lg:px-4 lg:tracking-[0.16em]",
                  on ? "text-gold" : "text-paper-3 is-hover:text-on-green recede:text-on-green/80",
                )}
              >
                {/* Slim bar: the icons fold away (lg up, where they show) and the labels go quiet. */}
                <NavIcon k={n.key} className="hidden size-5 transition-[width,opacity] duration-300 ease-hang lg:block condensed:w-0 condensed:opacity-0" />
                <span>{n.label}</span>
                <span aria-hidden="true" className={cx("absolute inset-x-2.5 bottom-2 h-px transition-all lg:inset-x-4", on ? "bg-gold" : "bg-transparent")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
