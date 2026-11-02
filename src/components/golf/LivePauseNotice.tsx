"use client";
// The slip a live page shows after 30 quiet minutes (src/lib/live/useLivePause.ts): live updates stopped so an
// unattended tab doesn't spend the Realtime budget, and one real button brings them back (subscribe, then refetch).
// The slip has the Toast's look (Locker Green, brass action) and sits where toasts do, above the phone tab bar. Its
// polite live region is always mounted, so the message is announced when it appears, and again when live is back.
import { useEffect, useRef, useState } from "react";
import { useLivePause } from "@/lib/live/useLivePause";
import { cx } from "../ui/cx";

export function LivePauseNotice({ what = "the scores" }: { /** What stopped updating: "the scores", "the flights board". */ what?: string }) {
  const { reason, resume } = useLivePause();
  const [back, setBack] = useState(false);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (backTimer.current) clearTimeout(backTimer.current); }, []);

  const onResume = () => {
    resume();
    setBack(true);
    if (backTimer.current) clearTimeout(backTimer.current);
    backTimer.current = setTimeout(() => setBack(false), 5000);
    // The button is about to go: keep the keyboard on the page, at its heading, not lost on <body>.
    requestAnimationFrame(() => {
      const h = document.querySelector<HTMLElement>("main h1");
      if (!h) return;
      if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    });
  };

  const idle = reason === "idle";
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[85] flex justify-center px-3 md:bottom-6"
    >
      {(idle || back) && (
        <div className={cx("tex-locker on-green pointer-events-auto flex w-full max-w-[34rem] flex-wrap items-center gap-x-3 gap-y-1 border border-gold/40 py-2 pl-4 pr-2 shadow-lift", "motion-safe:animate-toast")}>
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-gold" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round">
            {idle ? <path d="M5.75 3.5 V12.5 M10.25 3.5 V12.5" strokeWidth="2.2" /> : <circle cx="8" cy="8" r="4.5" fill="currentColor" />}
          </svg>
          <p className="min-w-0 flex-1 py-1.5 text-[0.98rem] leading-snug text-on-green">
            {idle ? <>Live updates to {what} paused after 30 quiet minutes.</> : <>Live updates are back on.</>}
          </p>
          {idle && (
            <button
              type="button"
              onClick={onResume}
              className="caps ml-auto min-h-tap shrink-0 rounded-xs border border-gold px-4 text-[0.88rem] text-gold transition-colors duration-150 is-hover:bg-gold is-hover:text-green-3 is-pressed:translate-y-px"
            >
              Resume live updates
            </button>
          )}
        </div>
      )}
    </div>
  );
}
