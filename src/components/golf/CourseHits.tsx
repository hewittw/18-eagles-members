// The results of "Find your course" (OpenGolfAPI): one real button per course, in an inset list.
import { cx } from "../ui/cx";
import type { CourseHit } from "@/lib/api/types";

export type CourseHitsProps = {
  hits: CourseHit[];
  onPick: (hit: CourseHit) => void;
  /** The course being opened right now (its row shows a spinner; the others wait). */
  pickingId?: string | null;
  /** The course already in the form (its row is marked "In the form"). */
  pickedId?: string | null;
  className?: string;
};

/** Name, place, and par · holes, and the whole row is the button. Selected = Locker Green with a check, in words too. */
export function CourseHits({ hits, onPick, pickingId, pickedId, className }: CourseHitsProps) {
  return (
    <ul className={cx("divide-y divide-rule/80 overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card", className)}>
      {hits.map((h) => {
        const picking = pickingId === h.id;
        const picked = pickedId === h.id;
        const place = [h.city, h.state ?? (h.country && h.country !== "US" ? h.country : null)].filter(Boolean).join(", ");
        const meta = [h.holes ? `${h.holes} holes` : null, h.par ? `par ${h.par}` : null].filter(Boolean).join(" · ");
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onPick(h)}
              disabled={!!pickingId && !picking}
              aria-pressed={picked}
              aria-busy={picking || undefined}
              className={cx(
                "group/hit flex min-h-18 w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 -outline-offset-2 sm:px-5",
                picked ? "on-green bg-green-3 text-on-green" : "text-ink is-hover:bg-paper-3 is-pressed:bg-tint",
                "disabled:cursor-not-allowed disabled:bg-paper-3 disabled:text-ink-2",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-balance text-[1.05rem] font-semibold leading-snug">{h.name}</span>
                <span className={cx("mt-0.5 block text-[0.92rem]", picked ? "text-paper-3" : "text-ink-2")}>
                  {place || "Place not listed"}{meta && <> · <span className="font-numeral tabular-nums">{meta}</span></>}
                </span>
              </span>
              <span className={cx("caps shrink-0 text-[0.72rem]", picked ? "text-gold" : "text-green")}>
                {picking ? (
                  <span className="inline-flex items-center gap-2">
                    <svg viewBox="0 0 20 20" className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" /><path d="M10 2.5 A7.5 7.5 0 0 1 17.5 10" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                    Opening
                  </span>
                ) : picked ? (
                  <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 12 12" className="size-3" aria-hidden="true"><path d="M2 6.5 L5 9 L10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>In the form</span>
                ) : (
                  <>
                    <span className="max-sm:sr-only">Use this course</span>
                    <svg viewBox="0 0 10 16" className="h-4 w-2.5 text-rule-strong sm:hidden" aria-hidden="true"><path d="M2 2 L8 8 L2 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
