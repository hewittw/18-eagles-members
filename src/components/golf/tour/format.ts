// Words and numbers for the Tour page, shared by its tables and cards. ESPN sends scores as text ("-25", "E", "+3");
// the board shows a true minus sign, and the same thing spoken for screen readers.

export type TourStatus = "playing" | "finished" | "not_started" | "cut" | "wd" | "dq" | "mdf";

/** Parse ESPN's to-par text to a number: "-25" → -25, "E" → 0, "+3" → 3; null if it isn't a score. */
export function parToPar(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = s.trim().replace("−", "-");
  if (/^e(ven)?$/i.test(t)) return 0;
  const n = Number(t);
  return Number.isFinite(n) && /^[+-]?\d+$/.test(t) ? n : null;
}

/** "−25", "E", "+3", or an en dash when there's no score. */
export function showToPar(s: string | null | undefined): string {
  const n = parToPar(s);
  if (n === null) return "–";
  return n === 0 ? "E" : n < 0 ? `−${-n}` : `+${n}`;
}

/** "25 under par", "even par", "3 over par", "no score". */
export function sayToPar(s: string | null | undefined): string {
  const n = parToPar(s);
  if (n === null) return "no score";
  return n === 0 ? "even par" : n < 0 ? `${-n} under par` : `${n} over par`;
}

/** The colour of a score on paper: red under par (always with the minus), ink for even, Fairway over (the board's way). */
export function toParTone(s: string | null | undefined): string {
  const n = parToPar(s);
  return n === null ? "text-ink-2" : n < 0 ? "text-under" : n === 0 ? "text-ink" : "text-over";
}

export const OUT_LABEL: Record<string, string> = { cut: "CUT", wd: "WD", dq: "DQ", mdf: "MDF" };
export const OUT_WORDS: Record<string, string> = { cut: "Missed the cut", wd: "Withdrew", dq: "Disqualified", mdf: "Made the cut, didn't finish" };

export const isOut = (status: string | null | undefined) => !!status && status in OUT_LABEL;

const ISO = /^\d{4}-\d{2}-\d{2}T/;

/** Tee time in the golfer's own time zone: "1:16 PM". */
export function teeTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** What the Thru column shows: "7", "F", "1:16 PM" (tee time), or an en dash. */
export function showThru(thru: string | null | undefined, status?: string | null): string {
  if (isOut(status)) return "–";
  if (!thru) return "–";
  if (ISO.test(thru)) return teeTime(thru);
  return thru;
}

/** Spoken Thru: "through 7", "finished the round", "tees off at 1:16 PM". */
export function sayThru(thru: string | null | undefined, status?: string | null): string {
  if (isOut(status)) return OUT_WORDS[status!] ?? "";
  if (!thru) return "";
  if (ISO.test(thru)) return `tees off at ${teeTime(thru)}`;
  if (thru === "F") return "finished the round";
  return `through ${thru}`;
}

/** "Thu, Nov 5". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
