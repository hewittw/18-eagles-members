"use client";
import Link from "next/link";
import type { MouseEvent } from "react";
import { cx } from "../ui/cx";

export type NavKey = "clubhouse" | "courses" | "cards" | "stats" | "tour" | "flights" | "locker";

export const NAV: { key: NavKey; label: string; href: string; hint: string }[] = [
  { key: "clubhouse", label: "Clubhouse", href: "/clubhouse", hint: "Home: your index and the next round" },
  { key: "courses", label: "Courses", href: "/clubhouse/courses", hint: "Pick a course and play" },
  { key: "cards", label: "Cards", href: "/clubhouse/rounds", hint: "Every round, kept" },
  { key: "stats", label: "Stats", href: "/clubhouse/stats", hint: "How you play" },
  { key: "tour", label: "Tour", href: "/clubhouse/tour", hint: "Live leaderboard and your players" },
  { key: "flights", label: "Flights", href: "/clubhouse/flights", hint: "Live traffic at your airports" },
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
      {/* Tour: the leaderboard on its two posts, a column of names and a column of scores. */}
      {k === "tour" && (<><rect {...p} x="3" y="3" width="18" height="12.5" rx="0.5" /><path {...p} d="M6 6.8 H12 M6 9.3 H12 M6 11.8 H12 M15 6.8 H18 M15 9.3 H18 M15 11.8 H18" /><path {...p} d="M7 15.5 V21.5 M17 15.5 V21.5" /></>)}
      {/* Flights: an airliner seen from above. */}
      {k === "flights" && <path {...p} d="M12 2.2 C12.9 2.2 13.4 3.2 13.4 4.4 V9.4 L21.2 13.8 V15.9 L13.4 13.4 V18.3 L15.9 20.1 V21.6 L12 20.6 L8.1 21.6 V20.1 L10.6 18.3 V13.4 L2.8 15.9 V13.8 L10.6 9.4 V4.4 C10.6 3.2 11.1 2.2 12 2.2 Z" />}
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

/** The tool's seven places, in the same order everywhere. The current one gets aria-current="page" and a brass mark. */
export function AppNav({ current, variant = "bar", label = "18 Eagles", className }: AppNavProps) {
  if (variant === "tabs") {
    return (
      <nav aria-label={label} className={className}>
        {/* Seven tabs: each is as wide as its own label plus an equal share of the rest (not 7 equal columns). Below
            400px the icon pill narrows and labels drop to 10px (iOS's tab-label size), so nothing breaks mid-word at 320px. */}
        <ul className="mx-auto flex min-h-[var(--tabbar)] w-full max-w-xl">
          {NAV.map((n) => {
            const on = current === n.key;
            return (
              <li key={n.key} className="flex min-w-0 flex-auto">
                <Link
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  onClick={(e) => toTopIfHere(e, n.href)}
                  className={cx(
                    "relative flex min-h-tile w-full flex-col items-center justify-center gap-0.5 px-0 pb-1 pt-1.5 min-[400px]:px-0.5 transition-colors duration-150 -outline-offset-4",
                    on ? "text-green" : "text-ink-2 is-hover:text-ink is-pressed:text-green",
                  )}
                >
                  <span aria-hidden="true" className={cx("grid h-7 w-10 place-items-center rounded-full transition-colors min-[400px]:w-12", on ? "bg-tint" : "bg-transparent")}>
                    <NavIcon k={n.key} className={cx("size-[1.35rem]", on && "[&_path]:stroke-[1.9]")} />
                  </span>
                  <span className={cx("max-w-full text-center text-[0.625rem] leading-tight min-[400px]:text-[0.68rem] tracking-[0.01em] [overflow-wrap:anywhere]", on ? "font-bold" : "font-medium")}>{n.label}</span>
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
      <ul className="flex flex-wrap items-stretch justify-end gap-x-0.5 lg:gap-x-1">
        {NAV.map((n) => {
          const on = current === n.key;
          return (
            <li key={n.key}>
              <Link
                href={n.href}
                aria-current={on ? "page" : undefined}
                onClick={(e) => toTopIfHere(e, n.href)}
                className={cx(
                  "caps relative flex min-h-tap items-center gap-2 px-1 text-[0.76rem] tracking-[0.07em] condensed:gap-0 transition-[color,gap] duration-200 lg:px-2.5 lg:text-[0.85rem] lg:tracking-[0.14em] xl:px-4 xl:tracking-[0.16em]",
                  on ? "text-gold" : "text-paper-3 is-hover:text-on-green recede:text-on-green/80",
                )}
              >
                {/* Seven places: tablets get tighter caps (md), icons join from xl where there is room. Slim bar: the icons fold away and the labels go quiet. */}
                <NavIcon k={n.key} className="hidden size-5 transition-[width,opacity] duration-300 ease-hang xl:block condensed:w-0 condensed:opacity-0" />
                <span>{n.label}</span>
                <span aria-hidden="true" className={cx("absolute inset-x-1 bottom-2 h-px transition-all lg:inset-x-2.5 xl:inset-x-4", on ? "bg-gold" : "bg-transparent")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
