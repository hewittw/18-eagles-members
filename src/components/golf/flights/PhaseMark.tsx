// What an aircraft near the field is doing, drawn (no emoji, no icon font). Always paired with words on the page,
// so the shape repeats the meaning and colour never carries it alone.
import { cx } from "@/components/ui";

export type Phase = "arriving" | "departing" | "ground" | "overhead";

export const PHASE_LABEL: Record<Phase, string> = {
  arriving: "Arriving",
  departing: "Departing",
  ground: "On the ground",
  overhead: "Passing over",
};

/** arriving: a path gliding down to a runway bar. departing: climbing off it. ground: wheels on the bar. overhead: level. */
export function PhaseMark({ phase, className }: { phase: Phase; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-5 shrink-0", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {phase === "arriving" && (<><path d="M3 5 L15 15" /><path d="M10.5 15.2 L15 15 L14.8 10.5" /><path d="M12 20 H22" /></>)}
      {phase === "departing" && (<><path d="M2 20 H12" /><path d="M9 15 L21 5" /><path d="M16.5 4.8 L21 5 L20.8 9.5" /></>)}
      {phase === "ground" && (<><path d="M2 19 H22" /><circle cx="8" cy="15.5" r="2" /><circle cx="16" cy="15.5" r="2" /><path d="M5 11 H19" /></>)}
      {phase === "overhead" && (<><path d="M2 12 H19" /><path d="M15 8 L19.5 12 L15 16" /><path d="M2 20 H22" strokeDasharray="2 3" strokeOpacity=".6" /></>)}
    </svg>
  );
}
