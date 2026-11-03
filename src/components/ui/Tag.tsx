import type { ReactNode } from "react";
import { cx } from "./cx";

export type TagProps = { tone?: "neutral" | "green" | "gold"; children: ReactNode; className?: string };

/**
 * A small condensed-caps label: "Links", "Major host", "Personal best". Text, so never color alone. No icon: a tag
 * is a label, not an action, and the gold tone's old four-point star read as a "+" (the user took "Home" for "add").
 */
export function Tag({ tone = "neutral", children, className }: TagProps) {
  return (
    <span
      className={cx(
        "caps inline-flex min-h-6 items-center gap-1.5 rounded-xs border px-2 py-0.5 text-[0.74rem] leading-none whitespace-nowrap",
        tone === "neutral" && "border-rule-strong bg-paper-2 text-ink-2",
        tone === "green" && "border-green-3 bg-green-3 text-on-green",
        tone === "gold" && "border-gold-ink bg-paper-2 text-gold-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
