// The three designed states every outside-data feature needs (loading, nothing found, the service is down), and
// the small attribution line both data sources ask for. Calm and specific, in the clubhouse voice: never a raw error.
import type { ReactNode } from "react";
import { cx } from "../ui/cx";

export type ApiStateProps = {
  kind: "loading" | "empty" | "down";
  /** What's loading, for screen readers: "Loading the conditions at Torrey Pines". */
  label?: string;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  /** The loading skeleton's shape, matched to what will replace it, so nothing jumps. */
  shape?: "panel" | "list" | "strip" | "line";
  tone?: "paper" | "green";
  className?: string;
};

/**
 * Loading: a skeleton the size of the answer (a `role="status"` line says what's loading). Empty and down: a drawn
 * mark, a title, what to do next, and an action. All three sit in a polite live region, so a result is announced.
 */
export function ApiState({ kind, label, title, children, action, shape = "panel", tone = "paper", className }: ApiStateProps) {
  const green = tone === "green";
  if (kind === "loading") {
    return (
      <div role="status" className={cx("min-w-0", className)}>
        <span className="sr-only">{label ?? "Loading"}</span>
        <Skeleton shape={shape} green={green} />
      </div>
    );
  }
  return (
    <div
      role="status"
      className={cx(
        "flex min-w-0 gap-4 rounded-xl border p-5 sm:p-6",
        green ? "on-green border-white/25 bg-white/5" : kind === "down" ? "border-dashed border-rule-strong bg-paper-3" : "border-rule/70 bg-paper-2",
        className,
      )}
    >
      {kind === "empty" ? <EmptyMark className={green ? "text-gold" : "text-green"} /> : <RestingMark className={green ? "text-gold" : "text-ink-2"} />}
      <div className="min-w-0 flex-1">
        {title && <p className={cx("font-serif text-[1.15rem] font-bold leading-snug", green ? "text-on-green" : "text-ink")}>{title}</p>}
        {children && <div className={cx("text-[0.98rem] leading-relaxed", green ? "text-paper-3" : "text-ink-2", title && "mt-1")}>{children}</div>}
        {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

function Skeleton({ shape, green }: { shape: NonNullable<ApiStateProps["shape"]>; green: boolean }) {
  const bar = cx("block rounded-xs animate-pulse motion-reduce:animate-none", green ? "bg-white/15" : "bg-paper-3");
  const frame = cx("overflow-hidden rounded-xl border", green ? "border-white/20" : "border-rule/70 bg-paper-2");
  if (shape === "line") return <span aria-hidden="true" className={cx(bar, "h-5 w-48 max-w-full")} />;
  if (shape === "list") {
    return (
      <ul aria-hidden="true" className={cx(frame, "divide-y", green ? "divide-white/15" : "divide-rule/70")}>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex min-h-18 items-center gap-4 px-4 py-3.5">
            <span className="grid min-w-0 flex-1 gap-2">
              <span className={cx(bar, "h-4")} style={{ width: `${[72, 58, 66, 50][i]}%` }} />
              <span className={cx(bar, "h-3 w-28")} />
            </span>
            <span className={cx(bar, "h-4 w-14")} />
          </li>
        ))}
      </ul>
    );
  }
  if (shape === "strip") {
    return (
      <div aria-hidden="true" className={cx(frame, "flex")}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={cx("grid flex-1 justify-items-center gap-2 px-2 py-3", i > 0 && (green ? "border-l border-white/15" : "border-l border-rule/70"))}>
            <span className={cx(bar, "h-3 w-8")} />
            <span className={cx(bar, "size-7 rounded-full")} />
            <span className={cx(bar, "h-4 w-7")} />
          </span>
        ))}
      </div>
    );
  }
  // panel: the conditions card's own outline (temperature, wind, three facts, the read)
  return (
    <div aria-hidden="true" className={cx(frame, "grid gap-5 p-5 sm:p-6")}>
      <span className={cx(bar, "h-3.5 w-52 max-w-full")} />
      <span className="flex items-center gap-4">
        <span className={cx(bar, "size-14 rounded-full")} />
        <span className="grid gap-2"><span className={cx(bar, "h-10 w-24")} /><span className={cx(bar, "h-3.5 w-36")} /></span>
      </span>
      <span className="grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((i) => <span key={i} className={cx(bar, "h-12")} />)}</span>
      <span className="grid gap-2"><span className={cx(bar, "h-4 w-44")} /><span className={cx(bar, "h-3.5 w-full max-w-md")} /></span>
    </div>
  );
}

/** Nothing found: an empty cup on the green. */
function EmptyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cx("size-10 shrink-0", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <ellipse cx="20" cy="30" rx="15" ry="5.5" strokeOpacity=".45" />
      <ellipse cx="20" cy="30" rx="4.2" ry="1.7" fill="currentColor" fillOpacity=".25" />
      <path d="M20 29 V5" />
      <path d="M20.5 5.5 L30 8.8 L20.5 12" fill="currentColor" fillOpacity=".2" />
    </svg>
  );
}

/** The service is resting: the flag is down, laid against the pin. */
function RestingMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cx("size-10 shrink-0", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="20" cy="31" rx="15" ry="5" strokeOpacity=".45" strokeDasharray="2.5 3" />
      <path d="M20 31 V6" />
      <path d="M20.6 7 C23 10 22.5 14 21 17 L20.6 7 Z" fill="currentColor" fillOpacity=".25" />
      <path d="M27 9 l3 0 M28.5 7.5 v3" strokeOpacity=".7" />
    </svg>
  );
}

// ───────── ApiCredit ─────────
export type ApiCreditProps = { source: "opengolf" | "open-meteo"; tone?: "paper" | "green"; className?: string; /** Live data (refreshed every 10 minutes) vs a reading kept on a card. */ live?: boolean; /** "span" inside another paragraph. */ as?: "p" | "span" };

/** The attribution each source asks for, wherever its data shows. Small and quiet, with real links. */
export function ApiCredit({ source, tone = "paper", className, live = true, as: P = "p" }: ApiCreditProps) {
  const cls = cx("block text-[0.8rem] leading-snug", tone === "green" ? "text-paper-3" : "text-ink-2", className);
  if (source === "open-meteo") {
    return (
      <P className={cls}>
        Weather data by{" "}
        <a className="link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com<span className="sr-only"> (opens in a new tab)</span></a>
        {" "}(CC BY 4.0){live ? ", refreshed every 10 minutes" : ", as it was when the round began"}.
      </P>
    );
  }
  return (
    <P className={cls}>
      Course data ©{" "}
      <a className="link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors<span className="sr-only"> (opens in a new tab)</span></a>
      {" "}(ODbL 1.0) via{" "}
      <a className="link" href="https://opengolfapi.org/" target="_blank" rel="noreferrer">OpenGolfAPI<span className="sr-only"> (opens in a new tab)</span></a>.
    </P>
  );
}
