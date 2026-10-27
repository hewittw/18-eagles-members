"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cx } from "../ui/cx";
import { AppNav, type NavKey } from "./AppNav";
import { useMember } from "./useMember";

/** Works out the current tab from the URL (inside Suspense, so dynamic routes still prerender a shell). */
export function CurrentNav({ variant }: { variant: "bar" | "tabs" }) {
  const path = usePathname() ?? "";
  const current: NavKey | undefined =
    path.startsWith("/clubhouse/courses") || path.startsWith("/clubhouse/play") ? "courses"
    : path.startsWith("/clubhouse/rounds") || path.startsWith("/clubhouse/round") ? "cards"
    : path.startsWith("/clubhouse/stats") ? "stats"
    : path.startsWith("/clubhouse/locker") ? "locker"
    : path === "/clubhouse" || path === "/clubhouse/" || path.startsWith("/clubhouse/trophies") ? "clubhouse"
    : undefined;
  // Signed out, the only page you can be on is the public welcome, and every tab but its own needs a sign-in: the bar
  // shows just the wordmark and Sign in. Before Clerk knows (the server render), the welcome keeps the tabs' space
  // without showing them, so neither a visitor nor a member sees them flicker.
  const member = useMember();
  if (member === "out") return null;
  return <AppNav current={current} variant={variant} className={cx(member === "unknown" && isWelcome(path) && "invisible")} />;
}

const isWelcome = (path: string) => path === "/clubhouse" || path === "/clubhouse/";

/** A hole being played: /clubhouse/rounds/[id]/[hole]. Not the list, Log a round, or the card. */
export const isHoleRoute = (path: string) => /^\/clubhouse\/rounds\/(?!new\/)[^/]+\/[^/]+\/?$/.test(path);

/**
 * The phone tab bar, left out on the hole screen: scoring is a focused flow (as iOS hides the tab bar in one),
 * so the hole's own action bar takes the bottom edge. Signed out (the welcome) there are no tabs to offer. `--tabbar` drops to 0 there, so everything that clears
 * the tab bar (sticky bars, the footer's padding) closes up. The way out stays: the back pill and the header logo.
 */
export function PhoneTabBar({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const member = useMember();
  if (isHoleRoute(path) || member === "out") return <style>{`@media (width < 48rem) { :root { --tabbar: 0px; } }`}</style>;
  if (member === "unknown" && isWelcome(path)) return <div className="invisible">{children}</div>;
  return children;
}
