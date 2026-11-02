"use client";
// Follow / unfollow an airport: a real toggle button (aria-pressed). Its accessible name is always "Follow <code>,
// <airport>", and the pressed state says whether you do. The visible word changes too ("Follow" / "Following"),
// with a drawn plus or a tick, so the state is never colour alone. Works on paper and on the Locker Green band.
import { cx } from "@/components/ui";

export type FollowToggleProps = {
  /** Spoken after "Follow": "SAN, San Diego International Airport". */
  label: string;
  following: boolean;
  onToggle: () => void;
  busy?: boolean;
  /** Unavailable (the 6-airport limit): stays focusable and says why through `title`/description, never silently dead. */
  disabled?: boolean;
  tone?: "paper" | "green";
  className?: string;
  describedBy?: string;
  /** Visible word when not following, if "Follow" alone wouldn't say what ("Follow ORD"). */
  text?: string;
};

export function FollowToggle({ label, following, onToggle, busy, disabled, tone = "paper", className, describedBy, text }: FollowToggleProps) {
  const green = tone === "green";
  return (
    <button
      type="button"
      aria-pressed={following}
      aria-busy={busy || undefined}
      aria-disabled={disabled || undefined}
      aria-describedby={describedBy}
      onClick={() => { if (!busy && !disabled) onToggle(); }}
      className={cx(
        "inline-flex min-h-tap shrink-0 select-none items-center justify-center gap-2 rounded-full border px-4 font-numeral text-[0.9rem] font-semibold uppercase leading-none tracking-[0.08em]",
        "transition-[background-color,border-color,color,transform] duration-150 is-pressed:translate-y-px",
        green
          ? following
            ? "border-on-green bg-on-green text-green-3 is-hover:bg-paper-3"
            : "border-white/60 bg-white/10 text-on-green is-hover:bg-white/20"
          : following
            ? "border-green bg-green text-on-green is-hover:border-green-2 is-hover:bg-green-2"
            : "border-rule-strong bg-paper-2 text-green is-hover:border-green is-hover:bg-tint",
        disabled && !following && "cursor-not-allowed border-dashed bg-transparent text-ink-2 is-hover:border-rule-strong is-hover:bg-transparent",
        busy && "cursor-progress opacity-80",
        className,
      )}
    >
      <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
        {following ? (
          <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        ) : (
          <path d="M7 2 V12 M2 7 H12" fill="none" stroke="currentColor" strokeWidth="1.7" />
        )}
      </svg>
      <span aria-hidden="true">{following ? "Following" : text ?? "Follow"}</span>
      <span className="sr-only">Follow {label}</span>
    </button>
  );
}
