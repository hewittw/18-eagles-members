"use client";
// Follow / unfollow a tour player: a real toggle button (aria-pressed). The accessible name is always
// "Follow <name>", and the pressed state says whether you do. Pressed fills Locker Green with a brass tick, so the
// state is never colour alone. On phones (`compact`) the word hides and the drawn mark stays, still 44 px square.
import { cx } from "@/components/ui";

export type FollowButtonProps = {
  name: string;
  following: boolean;
  onToggle: () => void;
  /** Saving: the button stays pressable-looking but ignores clicks until the server answers. */
  busy?: boolean;
  /** Hide the word below the sm breakpoint (tables on phones). */
  compact?: boolean;
  className?: string;
};

export function FollowButton({ name, following, onToggle, busy, compact, className }: FollowButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={following}
      aria-busy={busy || undefined}
      onClick={() => { if (!busy) onToggle(); }}
      className={cx(
        "inline-flex min-h-tap min-w-tap shrink-0 select-none items-center justify-center gap-1.5 rounded-full border font-numeral text-[0.88rem] font-semibold uppercase tracking-[0.08em] leading-none",
        "transition-[background-color,border-color,color,transform] duration-150 is-pressed:translate-y-px",
        compact ? "px-0 sm:px-3.5" : "px-3.5",
        following
          ? "border-green-3 bg-green-3 text-on-green is-hover:border-green-2 is-hover:bg-green-2"
          : "border-rule-strong bg-paper-2 text-green is-hover:border-green is-hover:bg-tint",
        busy && "cursor-progress opacity-80",
        className,
      )}
    >
      <svg viewBox="0 0 14 14" className={cx("size-3.5 shrink-0", following ? "text-gold" : "text-green")} aria-hidden="true">
        {following ? (
          <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        ) : (
          <path d="M7 2 V12 M2 7 H12" fill="none" stroke="currentColor" strokeWidth="1.7" />
        )}
      </svg>
      <span className={cx(compact && "sr-only sm:not-sr-only")}>Follow</span>
      <span className="sr-only"> {name}</span>
    </button>
  );
}
