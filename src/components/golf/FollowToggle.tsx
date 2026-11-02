"use client";
// Follow / unfollow (a tour player on /clubhouse/tour, an airport on /clubhouse/flights): one shared toggle, so the
// two live pages press the same way. It is ToggleChip's grammar in Button's type: a real button with aria-pressed,
// condensed caps, a drawn plus at rest and a brass tick on Locker Green when pressed (state is never colour alone).
// The visible word stays "Follow" and the accessible name is "Follow <label>", so the visible label is always
// inside the name (WCAG 2.5.3) and the pressed state says whether you do.
import { cx } from "../ui/cx";

export type FollowToggleProps = {
  /** Spoken after "Follow": "Scottie Scheffler", "SAN, San Diego International Airport". */
  label: string;
  following: boolean;
  onToggle: () => void;
  /** Saving: looks pressable but ignores clicks until the server answers. */
  busy?: boolean;
  /** At a follow limit: stays focusable (aria-disabled) and points at the reason through `describedBy`. */
  disabled?: boolean;
  describedBy?: string;
  /** The surface it sits on. "green" for Locker Green bands. */
  tone?: "paper" | "green";
  /** Hide the word below the sm breakpoint (dense tables on phones); the mark stays, still 44 px square. */
  compact?: boolean;
  /** Visible word, if "Follow" alone wouldn't say what ("Follow ORD"). Must start with "Follow". */
  text?: string;
  className?: string;
};

export function FollowToggle({ label, following, onToggle, busy, disabled, describedBy, tone = "paper", compact, text, className }: FollowToggleProps) {
  const green = tone === "green";
  const off = disabled && !following;
  return (
    <button
      type="button"
      aria-pressed={following}
      aria-busy={busy || undefined}
      aria-disabled={off || undefined}
      aria-describedby={describedBy}
      onClick={() => { if (!busy && !off) onToggle(); }}
      className={cx(
        "inline-flex min-h-tap min-w-tap shrink-0 select-none items-center justify-center gap-1.5 rounded-full border font-numeral text-[0.88rem] font-semibold uppercase leading-none tracking-[0.08em]",
        "transition-[background-color,border-color,color,transform] duration-150 ease-press is-pressed:translate-y-px",
        compact ? "px-0 sm:px-3.5" : "px-3.5",
        green
          ? following
            ? "border-on-green bg-on-green text-green-3 is-hover:border-paper-2 is-hover:bg-paper-2"
            : "border-white/50 bg-white/10 text-on-green is-hover:bg-white/18"
          : following
            ? "border-green-3 bg-green-3 text-on-green is-hover:border-green-2 is-hover:bg-green-2"
            : "border-rule-strong bg-paper-2 text-green is-hover:border-green is-hover:bg-tint",
        off && (green
          ? "cursor-not-allowed border-dashed border-paper-3/50 bg-transparent text-paper-3 is-hover:bg-transparent"
          : "cursor-not-allowed border-dashed bg-transparent text-ink-2 is-hover:border-rule-strong is-hover:bg-transparent"),
        busy && "cursor-progress opacity-80",
        className,
      )}
    >
      <svg viewBox="0 0 14 14" className={cx("size-3.5 shrink-0", following && !green && "text-gold")} aria-hidden="true">
        {following ? (
          <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        ) : (
          <path d="M7 2 V12 M2 7 H12" fill="none" stroke="currentColor" strokeWidth="1.7" />
        )}
      </svg>
      <span aria-hidden="true" className={cx(compact && "hidden sm:inline")}>{text ?? "Follow"}</span>
      <span className="sr-only">Follow {label}</span>
    </button>
  );
}
