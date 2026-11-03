"use client";
// /clubhouse/flights, "Getting there". Three short steps, top to bottom: you're near ORD (from the browser's location,
// which never leaves this tab) → where are you playing? (your courses, or somewhere else) → the flights between the two
// airports right now, or "you can drive this one". Nothing renders past the location panel until a position is known.
// The choice is saved as a trip (two airport codes and a label, setTrip); the board is a snapshot of trip_flights,
// then Realtime pushes of only the rows the poll-flights worker changed. The browser never calls a flight source.
// Beside each automatic airport the page offers up to two others within 75 mi ("or ORD 15 mi"); a golfer's pick is
// saved in the trip and wins while it's still one of the airports offered for where they are.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ApiState, Freshness, LivePauseNotice, PageHeader, PhotoBand } from "@/components/golf";
import { PhaseMark } from "@/components/golf/flights/PhaseMark";
import { Button, cx, Field, Tag, TextInput, useToast } from "@/components/ui";
import { courseGeo, defaultHome } from "@/lib/courses";
import type { Course } from "@/lib/course-types";
import { useClub } from "@/lib/hooks";
import { airportByCode, haversineMi, searchAirports, suggestNear, type Airport, type NearAirports } from "@/lib/live/airports";
import { useSupabaseBrowser } from "@/lib/live/browser";
import { DRIVE_MI, pairKey } from "@/lib/live/suggest";
import { useGeolocation, type GeoState } from "@/lib/live/useGeolocation";
import { useWorkerHealth, type WorkerHealth } from "@/lib/live/useWorkerHealth";
import { setTrip, type Trip } from "@/lib/server/trip-actions";
import { Page } from "../../_components/Placeholder";
import { useTripFlights, type TripBoard, type TripFlight } from "./useTripFlights";

const EVERY_SEC = 30;
const PREVIEW = 6;
// The band's photo: Pebble Beach's 18th along Carmel Bay, the trip a golfer flies in for (docs/credits.md, Pebble Beach hero.jpg).
const BAND_PHOTO = { src: "/courses/pebble-beach/graded/hero.jpg", credit: "Bernard Gagnon, CC BY-SA 3.0" };
const ELSEWHERE = "elsewhere";

/** "Chicago O'Hare International Airport" → "Chicago O'Hare International" (the board's voice; the code is beside it). */
const shortName = (a: Airport) => a.name.replace(/\s+Airport$/i, "");
const miles = (n: number) => `${Math.max(1, Math.round(n)).toLocaleString("en-US")} mi`;
const cityOf = (a: Airport | null | undefined, code: string) => a?.city?.split(/[/,]/)[0]?.trim() || code;

export function FlightsBoard() {
  const geo = useGeolocation();
  return (
    <>
      <PhotoBand aria-label="Flights" photo={BAND_PHOTO}>
        <div className="mx-auto max-w-ledger px-4 pb-12 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:px-8">
          <PageHeader tone="green" className="bg-transparent" eyebrow="Getting there" title="Flights" lede="Where you are, where you're playing, and the flights between them, live." />
        </div>
      </PhotoBand>
      <Page className="grid gap-10 md:gap-12">
        {geo.state.kind === "ready" ? <TripPlanner geo={geo.state} relocate={geo.request} /> : <LocationGate state={geo.state} request={geo.request} />}
        <LivePauseNotice what="the flights board" />
      </Page>
    </>
  );
}

// ───────── The location gate ─────────

function PinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-9 shrink-0", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 28 C16 28 7 18.5 7 12.5 A9 9 0 0 1 25 12.5 C25 18.5 16 28 16 28 Z" />
      <circle cx="16" cy="12.5" r="3.2" />
      <path d="M9 29 H23" strokeDasharray="2 2.5" />
    </svg>
  );
}

function LocationGate({ state, request }: { state: Exclude<GeoState, { kind: "ready" }>; request: () => void }) {
  const k = state.kind;
  const title =
    k === "denied" ? "Location is turned off for this site"
    : k === "unavailable" ? "We couldn't find where you are"
    : k === "insecure" ? "Location needs a secure connection"
    : k === "unsupported" ? "This browser can't share a location"
    : "Turn on your location to plan getting there";
  return (
    <section aria-labelledby="gate-h" className="max-w-2xl rounded-xl border border-rule bg-paper-2 p-5 shadow-card sm:p-7">
      <div className="flex gap-4">
        <PinMark className="mt-0.5 text-green" />
        <div className="grid min-w-0 gap-3">
          <h2 id="gate-h" className="font-serif text-[1.35rem] font-bold leading-snug text-balance text-ink">{title}</h2>
          <div role="status" className="grid gap-2 text-[1rem] leading-relaxed text-ink-2">
            {(k === "idle" || k === "checking") && <p>We find the airport nearest you, then the flights from there to where you&apos;re playing.</p>}
            {k === "asking" && <p>Finding you… If your browser asks, choose <span className="font-semibold text-ink">Allow</span>.</p>}
            {k === "denied" && (
              <>
                <p>Flights needs your location, and this browser has been told not to share it with us.</p>
                <p>To turn it back on: click the settings icon at the left of the address bar, set <span className="font-semibold text-ink">Location</span> to <span className="font-semibold text-ink">Allow</span>, then reload this page. On an iPhone or iPad: Settings → Privacy &amp; Security → Location Services → your browser → While Using.</p>
              </>
            )}
            {k === "unavailable" && <p>{state.timedOut ? "Your device didn't find a position within 15 seconds." : "Your device couldn't find a position right now."} Check that location services are on, then try again.</p>}
            {k === "insecure" && <p>Browsers only share a location over https. Open this page at an address starting with https:// and try again.</p>}
            {k === "unsupported" && <p>Try a current version of Safari, Chrome, Firefox or Edge.</p>}
          </div>
          {k !== "insecure" && k !== "unsupported" && k !== "denied" && (
            <div className="pt-1">
              <Button variant="primary" onClick={request} disabled={k === "checking" || k === "asking"} aria-busy={k === "asking" || undefined}>
                {k === "unavailable" ? "Try again" : k === "asking" ? "Finding you…" : "Use my location"}
              </Button>
            </div>
          )}
          {k === "denied" && <div className="pt-1"><Button variant="secondary" onClick={() => window.location.reload()}>Reload the page</Button></div>}
          <p className="text-[0.9rem] text-ink-2">Your location stays in this browser. We save only the airport code.</p>
        </div>
      </div>
    </section>
  );
}

// ───────── The trip ─────────

type Pos = { lat: number; lon: number };
type Near = { state: "loading" } | ({ state: "ok" } & NearAirports) | { state: "none" } | { state: "error" };
type Option = { airport: Airport; miles: number };
// A course, flown into by its automatic airport, or by `via` (one of its alternatives) if the golfer chose one.
type Dest = { kind: "course"; slug: string; via?: string } | { kind: "airport"; airport: Airport } | { kind: "elsewhere" } | null;

/** The airport to use for a point: `want` if it's the pick or one of the alternatives offered, else the pick. Plus
 *  the others to offer beside it (at most two, nearest-large-first, as nearbyAlternatives ranked them). */
function resolve(near: Near | undefined, want: string | null | undefined): { use: Option; others: Option[] } | null {
  if (near?.state !== "ok") return null;
  const all: Option[] = [{ airport: near.airport, miles: near.miles }, ...near.alternatives];
  const use = all.find((o) => o.airport.code === want) ?? all[0];
  return { use, others: all.filter((o) => o !== use).slice(0, 2) };
}

function TripPlanner({ geo, relocate }: { geo: Pos & { at: number }; relocate: () => void }) {
  const db = useSupabaseBrowser();
  const toast = useToast();
  const health = useWorkerHealth("flights", EVERY_SEC);
  const { ready, store, course } = useClub();

  // Step 1: the airport nearest the golfer. Recomputed only when the position changes.
  const [origin, setOrigin] = useState<Near>({ state: "loading" });
  useEffect(() => {
    if (!db) return;
    let live = true;
    suggestNear(db, geo.lat, geo.lon)
      .then((s) => { if (live) setOrigin(s ? { state: "ok", ...s } : { state: "none" }); })
      .catch(() => { if (live) setOrigin({ state: "error" }); });
    return () => { live = false; };
  }, [db, geo.lat, geo.lon]);

  // The golfer's courses with a location: home first, then the ones they've played (latest first), then the ones they added.
  const { courses, homeSlug } = useMemo(() => {
    const home = store.profile.homeCourse ? course(store.profile.homeCourse) : defaultHome(null, store.customCourses);
    const played = [...store.rounds].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).map((r) => course(r.courseSlug));
    const seen = new Set<string>();
    const list: Course[] = [];
    for (const c of [home, ...played, ...store.customCourses]) {
      if (!c || seen.has(c.slug) || !courseGeo(c)) continue;
      seen.add(c.slug);
      list.push(c);
    }
    return { courses: list, homeSlug: home?.slug ?? null };
  }, [store.profile.homeCourse, store.rounds, store.customCourses, course]);

  // Each course's airport, by the same rule.
  const [courseAir, setCourseAir] = useState<Map<string, Near>>(() => new Map());
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!db) return;
    for (const c of courses) {
      if (asked.current.has(c.slug)) continue;
      asked.current.add(c.slug);
      const g = courseGeo(c)!;
      suggestNear(db, g.lat, g.lng)
        .then((r) => setCourseAir((m) => new Map(m).set(c.slug, r ? { state: "ok", ...r } : { state: "none" })))
        .catch(() => { asked.current.delete(c.slug); setCourseAir((m) => new Map(m).set(c.slug, { state: "error" })); });
    }
  }, [db, courses]);

  // The saved trip, restored once the courses' airports are known. Read with the browser client (RLS: only this
  // golfer's row), not the getTrip Server Action, which would queue behind the journal's loadClub.
  const [saved, setSaved] = useState<Trip | null | undefined>(undefined);
  useEffect(() => {
    if (!db) return;
    let live = true;
    void db.from("trips").select("from_airport, to_airport, dest_label, updated_at").maybeSingle<{ from_airport: string; to_airport: string; dest_label: string | null; updated_at: string }>()
      .then(({ data, error }) => {
        if (!live) return;
        setSaved(error || !data ? null : { from: data.from_airport, to: data.to_airport, label: data.dest_label, updatedAt: data.updated_at });
      }, () => { if (live) setSaved(null); });
    return () => { live = false; };
  }, [db]);

  // Where the golfer flies from: their own pick this visit, else the saved trip's origin, as long as it's one of the
  // airports offered for where they are now (else the automatic one). Waits for the saved trip, so it doesn't flicker.
  const [originPick, setOriginPick] = useState<string | null>(null);
  const from = saved === undefined ? null : resolve(origin, originPick ?? saved?.from);
  // The golfer's explicit choice wins; until they make one, the saved trip is shown as chosen: as its course when the
  // label and airport still match one, else as "somewhere else" with that airport.
  const [chosen, setDest] = useState<Dest>(null);
  const savedCourse = useMemo<{ slug: string } | "pending" | null>(() => {
    if (saved === undefined || !ready) return "pending";
    if (!saved) return null;
    const match = courses.find((c) => (c.shortName || c.name) === saved.label);
    const near = match ? courseAir.get(match.slug) : undefined;
    if (match && (!near || near.state === "loading")) return "pending";
    // The course still matches if the saved airport is its pick or one of its alternatives (the golfer chose it).
    return match && resolve(near, saved.to)?.use.airport.code === saved.to ? { slug: match.slug } : null;
  }, [saved, ready, courses, courseAir]);
  const savedVia = saved?.to;
  const [savedAirport, setSavedAirport] = useState<Airport | null>(null);
  useEffect(() => {
    if (!db || !saved || savedCourse !== null) return;
    let live = true;
    airportByCode(db, saved.to).then((a) => { if (live) setSavedAirport(a); }).catch(() => {});
    return () => { live = false; };
  }, [db, saved, savedCourse]);
  const dest: Dest = chosen
    ?? (savedCourse && savedCourse !== "pending" ? { kind: "course", slug: savedCourse.slug, via: savedVia } : savedCourse === null && savedAirport ? { kind: "airport", airport: savedAirport } : null);

  // Where we're flying into, and what to call it.
  const destCourse = dest?.kind === "course" ? courses.find((c) => c.slug === dest.slug) ?? null : null;
  const destNear = destCourse ? courseAir.get(destCourse.slug) : undefined;
  const into = destCourse && dest?.kind === "course" ? resolve(destNear, dest.via) : null;
  const destAirport = dest?.kind === "airport" ? dest.airport : into?.use.airport ?? null;
  const destLabel = destCourse ? destCourse.shortName || destCourse.name : destAirport ? shortName(destAirport) : null;
  const fromAirport = from?.use.airport ?? null;

  // Save the trip when the choice (or the origin) changes. Debounced, so arrowing through the list saves once.
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (saved === undefined || !fromAirport || !destAirport) return;
    const sig = `${fromAirport.code}>${destAirport.code}>${destLabel ?? ""}`;
    if (lastSaved.current === null && saved && `${saved.from}>${saved.to}>${saved.label ?? ""}` === sig) { lastSaved.current = sig; return; }
    if (lastSaved.current === sig) return;
    const t = setTimeout(() => {
      lastSaved.current = sig;
      setTrip(fromAirport.code, destAirport.code, destLabel)
        .then((r) => { if (!r.ok) { lastSaved.current = null; toast({ message: r.error }); } })
        .catch(() => { lastSaved.current = null; toast({ message: "Couldn't save your trip. Check your connection." }); });
    }, 400);
    return () => clearTimeout(t);
  }, [saved, fromAirport, destAirport, destLabel, toast]);

  // Drive or fly: the same airport, or the place within 150 mi of the golfer, straight line.
  const destPoint: Pos | null = destCourse ? (() => { const g = courseGeo(destCourse)!; return { lat: g.lat, lon: g.lng }; })() : destAirport ? { lat: destAirport.lat, lon: destAirport.lon } : null;
  const away = destPoint ? haversineMi(geo.lat, geo.lon, destPoint.lat, destPoint.lon) : null;
  const drive = !!(destAirport && fromAirport && (destAirport.code === fromAirport.code || (away !== null && away < DRIVE_MI)));
  const pair = fromAirport && destAirport && !drive ? pairKey(fromAirport.code, destAirport.code) : null;

  return (
    <>
      <YouAreNear origin={origin} from={from} pick={setOriginPick} relocate={relocate} />
      {origin.state === "ok" && (
        <WherePlaying
          ready={ready}
          courses={courses}
          homeSlug={homeSlug}
          courseAir={courseAir}
          dest={dest}
          setDest={setDest}
          into={into && destLabel ? { ...into, label: destLabel } : null}
        />
      )}
      {origin.state === "ok" && destAirport && destLabel && fromAirport && (
        drive ? (
          <section aria-labelledby="drive-h" aria-live="polite" className="grid max-w-2xl gap-2 rounded-xl border border-rule bg-paper-2 p-5 shadow-card sm:p-6">
            <h2 id="drive-h" className="font-serif text-[1.35rem] font-bold leading-snug text-ink">You can drive this one</h2>
            <p className="text-[1rem] leading-relaxed text-ink-2">
              {destLabel} is <span className="font-numeral text-[1.05rem] font-semibold tabular-nums text-ink">{miles(away ?? 0)}</span> from you, straight line
              {destAirport.code === fromAirport.code ? `, and ${destAirport.code} is the nearest airport to you both` : ""}.
            </p>
          </section>
        ) : pair ? (
          <RouteBoard pair={pair} from={fromAirport} to={destAirport} health={health} />
        ) : null
      )}
      {origin.state === "ok" && <Credit />}
    </>
  );
}

/** "or [ORD 15 mi] [GYY 22 mi]": the other airports near a point, each a small real button. */
function OrAirports({ options, onPick, lead = "or", className }: { options: Option[]; onPick: (a: Airport) => void; lead?: string; className?: string }) {
  if (!options.length) return null;
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-x-1 gap-y-1", className)}>
      <span className="pr-1 text-[0.95rem] text-ink-2">{lead}</span>
      {options.map((o) => (
        <Button
          key={o.airport.code}
          variant="quiet"
          size="sm"
          className="px-2.5 tracking-wide"
          onClick={() => onPick(o.airport)}
          aria-label={`Use ${o.airport.code}, ${shortName(o.airport)}, ${Math.max(1, Math.round(o.miles))} miles instead`}
        >
          <span className="flex items-baseline gap-1.5">
            <span>{o.airport.code}</span>
            <span className="font-normal normal-case tabular-nums tracking-normal text-ink-2">{miles(o.miles)}</span>
          </span>
        </Button>
      ))}
    </span>
  );
}

/** After a swap the pressed button is gone (its airport is now the one used): put focus on the line that changed. */
function useFocusAfterSwap<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const swapped = useRef(false);
  useEffect(() => {
    if (!swapped.current) return;
    swapped.current = false;
    ref.current?.focus();
  });
  const mark = useCallback(() => { swapped.current = true; }, []);
  return [ref, mark] as const;
}

function YouAreNear({ origin, from, pick, relocate }: { origin: Near; from: ReturnType<typeof resolve>; pick: (code: string) => void; relocate: () => void }) {
  const [lineRef, markSwap] = useFocusAfterSwap<HTMLParagraphElement>();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-rule py-4">
      <div className="grid min-w-0 gap-1">
      <div role="status" className="min-w-0">
      {(origin.state === "loading" || (origin.state === "ok" && !from)) && <p className="text-[1.05rem] text-ink-2">Finding the airport nearest you…</p>}
      {origin.state === "error" && <p className="text-[1.05rem] text-ink-2">Couldn&apos;t look up the airports near you. Check your connection, then update your location.</p>}
      {origin.state === "none" && <p className="text-[1.05rem] text-ink-2">There&apos;s no airport with airline service within 250 miles of you.</p>}
      {from && (
        <p ref={lineRef} tabIndex={-1} className="min-w-0 rounded-xs text-[1.05rem] leading-snug text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-focus">
          You&apos;re near <span className="font-numeral text-[1.3rem] font-semibold tracking-wide text-ink">{from.use.airport.code}</span>
          <span aria-hidden="true"> · </span><span className="text-ink">{shortName(from.use.airport)}</span>
          <span aria-hidden="true"> · </span><span className="whitespace-nowrap font-numeral tabular-nums">{miles(from.use.miles)}</span>
        </p>
      )}
      </div>
      {from && <OrAirports options={from.others} onPick={(a) => { markSwap(); pick(a.code); }} />}
      </div>
      <Button variant="quiet" size="sm" onClick={relocate}>Update location</Button>
    </div>
  );
}

// ───────── Where are you playing? (one choice list) ─────────

function WherePlaying({ ready, courses, homeSlug, courseAir, dest, setDest, into }: {
  ready: boolean; courses: Course[]; homeSlug: string | null; courseAir: Map<string, Near>; dest: Dest; setDest: (d: Dest) => void;
  /** The chosen course's airport and the others near it, or null (no course chosen, or its airport isn't known yet). */
  into: (NonNullable<ReturnType<typeof resolve>> & { label: string }) | null;
}) {
  const [all, setAll] = useState(false);
  const selectedSlug = dest?.kind === "course" ? dest.slug : null;
  const elsewhere = dest?.kind === "airport" || dest?.kind === "elsewhere";
  // Keep the chosen course visible even when the list is trimmed.
  const shown = all ? courses : courses.slice(0, PREVIEW).concat(selectedSlug && courses.findIndex((c) => c.slug === selectedSlug) >= PREVIEW ? courses.filter((c) => c.slug === selectedSlug) : []);
  const values = [...shown.map((c) => c.slug), ELSEWHERE];
  const current = selectedSlug ?? (elsewhere ? ELSEWHERE : null);
  const refs = useRef(new Map<string, HTMLDivElement>());

  const choose = useCallback((v: string) => {
    if (v === ELSEWHERE) { if (dest?.kind !== "airport") setDest({ kind: "elsewhere" }); }
    else if (dest?.kind !== "course" || dest.slug !== v) setDest({ kind: "course", slug: v });
  }, [dest, setDest]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>, v: string) => {
    const i = values.indexOf(v);
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % values.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + values.length) % values.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = values.length - 1;
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); choose(v); return; }
    if (next === null) return;
    e.preventDefault();
    choose(values[next]);
    refs.current.get(values[next])?.focus();
  };
  const tabStop = current ?? values[0];

  return (
    <section aria-labelledby="where-h" className="grid gap-4">
      <h2 id="where-h" className="font-serif text-[clamp(1.5rem,3vw,1.9rem)] font-bold leading-tight text-ink">Where are you playing?</h2>
      {!ready ? (
        <ApiState kind="loading" shape="list" label="Loading your courses" />
      ) : (
        <>
          <div role="radiogroup" aria-labelledby="where-h" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => (
              <CourseOption
                key={c.slug}
                course={c}
                home={c.slug === homeSlug}
                near={courseAir.get(c.slug) ?? { state: "loading" }}
                via={selectedSlug === c.slug ? into?.use ?? null : null}
                checked={selectedSlug === c.slug}
                tabIndex={tabStop === c.slug ? 0 : -1}
                onChoose={() => choose(c.slug)}
                onKeyDown={(e) => onKey(e, c.slug)}
                refFn={(el) => { if (el) refs.current.set(c.slug, el); else refs.current.delete(c.slug); }}
              />
            ))}
            <ElsewhereOption
              checked={elsewhere}
              airport={dest?.kind === "airport" ? dest.airport : null}
              tabIndex={tabStop === ELSEWHERE ? 0 : -1}
              onChoose={() => choose(ELSEWHERE)}
              onKeyDown={(e) => onKey(e, ELSEWHERE)}
              refFn={(el) => { if (el) refs.current.set(ELSEWHERE, el); else refs.current.delete(ELSEWHERE); }}
            />
          </div>
          {into && dest?.kind === "course" && (
            // The chosen card says which airport is used; this line offers the others. After a swap, focus goes back
            // to the card (its description now names the new airport).
            <OrAirports
              lead="Or fly into"
              options={into.others}
              onPick={(a) => { setDest({ kind: "course", slug: dest.slug, via: a.code }); requestAnimationFrame(() => refs.current.get(dest.slug)?.focus()); }}
            />
          )}
          {courses.length > PREVIEW && (
            <div><Button variant="quiet" size="sm" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? "Show fewer courses" : `Show all ${courses.length} courses`}</Button></div>
          )}
          {courses.length === 0 && (
            <p className="text-[0.95rem] text-ink-2">
              None of your courses has a map location yet. <Link className="link" href="/clubhouse/courses">Choose a home course</Link>, or pick somewhere else.
            </p>
          )}
          {elsewhere && <AirportSearch onPick={(a) => setDest({ kind: "airport", airport: a })} picked={dest?.kind === "airport" ? dest.airport.code : null} />}
        </>
      )}
    </section>
  );
}

const optionClass = (checked: boolean) => cx(
  "group/opt grid min-w-0 cursor-pointer content-start gap-3 rounded-xl border p-4 text-left shadow-card outline-none transition-[background-color,border-color] duration-150",
  "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  checked ? "border-green-3 bg-green-3 text-on-green" : "border-rule bg-paper-2 text-ink hover:border-ink hover:bg-paper-3 active:translate-y-px",
);

function Pip({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden="true" className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-current">
      <span className={cx("size-2 rounded-full bg-gold transition-transform duration-150 motion-reduce:transition-none", checked ? "scale-100" : "scale-0")} />
    </span>
  );
}

type OptionProps = { checked: boolean; tabIndex: number; onChoose: () => void; onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void; refFn: (el: HTMLDivElement | null) => void };

function CourseOption({ course, home, near: auto, via, checked, tabIndex, onChoose, onKeyDown, refFn }: OptionProps & { course: Course; home: boolean; near: Near; via: Option | null }) {
  const name = course.shortName || course.name;
  // The chosen course shows the airport actually used (an alternative, if the golfer picked one).
  const near: Near = via && auto.state === "ok" ? { ...auto, ...via } : auto;
  const id = `opt-${course.slug}`;
  return (
    <div ref={refFn} role="radio" aria-checked={checked} aria-labelledby={`${id}-n`} aria-describedby={`${id}-d`} tabIndex={tabIndex} onClick={onChoose} onKeyDown={onKeyDown} className={optionClass(checked)}>
      <div className="flex min-w-0 items-start gap-3">
        <Pip checked={checked} />
        <div className="min-w-0">
          <p id={`${id}-n`} className={cx("font-serif text-[1.15rem] font-bold leading-snug text-balance", checked ? "text-on-green" : "text-ink")}>{name}</p>
          {home && <Tag className="mt-1.5">Home course</Tag>}
        </div>
      </div>
      <p id={`${id}-d`} className={cx("min-w-0 border-t pt-3 text-[0.95rem] leading-snug", checked ? "border-white/25 text-paper-3" : "border-rule text-ink-2")}>
        {near.state === "loading" && <span className="block h-4 w-40 max-w-full animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none"><span className="sr-only">Finding the airport for {name}</span></span>}
        {near.state === "ok" && (
          <>
            <span className={checked ? "text-on-green" : "text-ink"}>Fly into <span className="font-numeral text-[1.1rem] font-semibold tracking-wide">{near.airport.code}</span>
              <span aria-hidden="true"> · </span><span className="whitespace-nowrap font-numeral tabular-nums">{miles(near.miles)}</span></span>
            <span aria-hidden="true"> · </span><span className="text-pretty">{shortName(near.airport)}</span>
          </>
        )}
        {near.state === "none" && "No airport with airline service within 250 miles."}
        {near.state === "error" && "Couldn't look up its airport. It tries again when you come back."}
      </p>
    </div>
  );
}

function ElsewhereOption({ checked, airport, tabIndex, onChoose, onKeyDown, refFn }: OptionProps & { airport: Airport | null }) {
  return (
    <div ref={refFn} role="radio" aria-checked={checked} aria-labelledby="opt-else-n" aria-describedby="opt-else-d" tabIndex={tabIndex} onClick={onChoose} onKeyDown={onKeyDown} className={optionClass(checked)}>
      <div className="flex min-w-0 items-start gap-3">
        <Pip checked={checked} />
        <p id="opt-else-n" className={cx("font-serif text-[1.15rem] font-bold leading-snug", checked ? "text-on-green" : "text-ink")}>Somewhere else</p>
      </div>
      <p id="opt-else-d" className={cx("min-w-0 border-t pt-3 text-[0.95rem] leading-snug", checked ? "border-white/25 text-paper-3" : "border-rule text-ink-2")}>
        {airport ? (
          <>
            <span className="text-on-green">Fly into <span className="font-numeral text-[1.1rem] font-semibold tracking-wide">{airport.code}</span></span>
            <span aria-hidden="true"> · </span>{shortName(airport)}
          </>
        ) : "Pick any airport."}
      </p>
    </div>
  );
}

type Search = { q: string; state: "idle" | "loading" | "done" | "error"; results: Airport[] };

function AirportSearch({ onPick, picked }: { onPick: (a: Airport) => void; picked: string | null }) {
  const db = useSupabaseBrowser();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ q: "", state: "idle", results: [] });

  useEffect(() => {
    const q = query.trim();
    if (!db || q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      setSearch((s) => ({ ...s, q, state: "loading" }));
      searchAirports(db, q)
        .then((results) => { if (live) setSearch({ q, state: "done", results }); })
        .catch(() => { if (live) setSearch({ q, state: "error", results: [] }); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [db, query]);

  const view = query.trim().length >= 2 ? search : { q: "", state: "idle" as const, results: [] };
  return (
    <div className="grid max-w-2xl gap-3">
      <Field label="Find an airport" hint="A code, a city, or a name: SAN, Monterey, Heathrow.">
        {(a) => <TextInput {...a} type="search" autoComplete="off" spellCheck={false} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Airport code, city or name" />}
      </Field>
      <p className="sr-only" aria-live="polite">
        {view.state === "done" ? (view.results.length ? `${view.results.length} airport${view.results.length === 1 ? "" : "s"} found.` : "No airports found.") : ""}
      </p>
      {view.state === "loading" && view.results.length === 0 && <ApiState kind="loading" shape="list" label="Searching airports" />}
      {view.state === "error" && <ApiState kind="down" title="The search didn't go through">Check your connection and try again.</ApiState>}
      {view.state === "done" && view.results.length === 0 && (
        <ApiState kind="empty" title={`No airport matches “${view.q}”`}>We list airports with airline service. Try the nearest city, or the three-letter code.</ApiState>
      )}
      {view.results.length > 0 && view.state !== "error" && (
        <ul className={cx("divide-y divide-rule border-y border-rule", view.state === "loading" && "opacity-60")}>
          {view.results.map((a) => (
            <li key={a.code}>
              <button
                type="button"
                onClick={() => { onPick(a); setQuery(""); }}
                aria-pressed={picked === a.code}
                className="grid w-full grid-cols-[3.6rem_minmax(0,1fr)] items-center gap-x-3 px-1 py-3 text-left outline-none hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-focus active:translate-y-px sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-4"
              >
                <span className="font-display text-[1.7rem] leading-none text-ink sm:text-[2rem]">{a.code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-medium text-ink">{a.name}</span>
                  <span className="block truncate text-[0.9rem] text-ink-2">{[a.city, a.country].filter(Boolean).join(", ")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────── The route board ─────────

function RouteBoard({ pair, from, to, health }: { pair: string; from: Airport; to: Airport; health: WorkerHealth }) {
  const db = useSupabaseBrowser();
  const board = useTripFlights(db, pair);
  const out = board.flights.filter((f) => f.origin === from.code).sort(byProgress);
  const back = board.flights.filter((f) => f.origin === to.code).sort(byProgress);
  return (
    <section aria-labelledby="board-h" className="grid gap-5">
      <div className="grid gap-2">
        <h2 id="board-h" className="font-serif text-[clamp(1.5rem,3vw,1.9rem)] font-bold leading-tight text-ink">
          Flights between <span className="font-numeral tracking-wide">{from.code}</span> and <span className="font-numeral tracking-wide">{to.code}</span> right now
        </h2>
        <Freshness health={health} what="The flights board" />
      </div>
      <BoardBody board={board} from={from} to={to} out={out} back={back} />
    </section>
  );
}

const byProgress = (a: TripFlight, b: TripFlight) => (b.progress_pct ?? 0) - (a.progress_pct ?? 0) || (a.flight ?? a.hex).localeCompare(b.flight ?? b.hex);

function BoardBody({ board, from, to, out, back }: { board: TripBoard; from: Airport; to: Airport; out: TripFlight[]; back: TripFlight[] }) {
  if (board.load === "loading") return <ApiState kind="loading" shape="list" label={`Loading flights between ${from.code} and ${to.code}`} />;
  if (board.load === "error") return <ApiState kind="down" title="The board didn't load">Check your connection; it fills in as soon as the next update arrives.</ApiState>;
  if (board.load === "waiting") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 p-5 text-[1rem] text-ink-2 shadow-card">
        <svg viewBox="0 0 16 16" className="size-5 shrink-0 text-green" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="5.5" strokeDasharray="2.2 2.4" /></svg>
        <p><span className="font-semibold text-ink">Finding flights on your route…</span> First check within 30 seconds.</p>
      </div>
    );
  }
  if (!out.length && !back.length) {
    return (
      <ApiState kind="empty" title={`No flights between ${from.code} and ${to.code} in the air right now`}>
        {board.airlines.length ? `${listOf(board.airlines)} ${board.airlines.length === 1 ? "flies" : "fly"} this route; check back soon.` : "Check back soon; the board fills in by itself."}
      </ApiState>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
      <Direction title={`To ${cityOf(to, to.code)}`} rows={out} touched={board.touched} none={`Nothing on its way to ${to.code} right now.`} />
      <Direction title={`Back to ${cityOf(from, from.code)}`} rows={back} touched={board.touched} none={`Nothing heading back to ${from.code} right now.`} />
    </div>
  );
}

const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

function Direction({ title, rows, touched, none }: { title: string; rows: TripFlight[]; touched: Map<string, number>; none: string }) {
  const id = `dir-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h3 id={id} className="flex items-baseline gap-2 border-b border-ink pb-1.5 text-green">
        <span className="caps text-label">{title}</span>
        <span className="ml-auto font-numeral text-[1rem] font-semibold tabular-nums text-ink">{rows.length}</span>
      </h3>
      {rows.length ? (
        <ul className="divide-y divide-rule">{rows.map((r) => <FlightRow key={r.hex} r={r} flashAt={touched.get(r.hex)} />)}</ul>
      ) : (
        <p className="py-3 text-[0.95rem] text-ink-2">{none}</p>
      )}
    </section>
  );
}

function whereWords(r: TripFlight): string {
  if (r.phase === "departing") return r.alt_ft === 0 ? `At the gate or taxiing at ${r.origin}` : `Climbing out of ${r.origin}`;
  if (r.phase === "arriving") return `On approach to ${r.destination}`;
  if (r.phase === "landed") return `Landed at ${r.destination}`;
  return r.progress_pct !== null ? `En route · ${r.progress_pct}% of the way` : "En route";
}

function FlightRow({ r, flashAt }: { r: TripFlight; flashAt: number | undefined }) {
  const ref = useFlash<HTMLLIElement>(flashAt);
  const name = r.flight ?? r.callsign ?? r.hex.toUpperCase();
  const alt = r.phase !== "landed" && r.alt_ft ? `${r.alt_ft.toLocaleString("en-US")} ft` : null;
  return (
    <li ref={ref} className="grid gap-1.5 py-3">
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-numeral text-[1.2rem] font-semibold leading-tight tracking-[0.04em] text-ink">{name}</span>
        <span className="text-[0.95rem] text-ink-2">
          {r.airline && <>{r.airline}<span aria-hidden="true"> · </span></>}
          <span className="whitespace-nowrap font-numeral tracking-wide">{r.origin} <span aria-hidden="true">→</span><span className="sr-only">to</span> {r.destination}</span>
        </span>
      </p>
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-[0.95rem] text-ink">
        <PhaseMark phase={r.phase} className="size-4 text-green" />
        <span>{whereWords(r)}</span>
        {alt && <><span aria-hidden="true" className="text-ink-2">·</span><span className="font-numeral tabular-nums text-ink-2">{alt}</span></>}
      </p>
      {r.phase === "en_route" && r.progress_pct !== null && <Progress pct={r.progress_pct} from={r.origin} to={r.destination} />}
    </li>
  );
}

/** A thin drawn line from origin to destination, the flown part solid, a brass dot where the plane is. */
function Progress({ pct, from, to }: { pct: number; from: string; to: string }) {
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2 pt-0.5" aria-hidden="true">
      <span className="font-numeral text-[0.8rem] tracking-wide text-ink-2">{from}</span>
      <span className="relative h-3 min-w-0 flex-1">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-rule-strong" />
        <span className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-green" style={{ width: `${p}%` }} />
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-green-3 bg-gold" style={{ left: `${p}%` }} />
      </span>
      <span className="font-numeral text-[0.8rem] tracking-wide text-ink-2">{to}</span>
    </div>
  );
}

/** A row a pushed change touched washes Fairway Tint and fades back, once. Nothing under reduced motion. */
function useFlash<T extends HTMLElement>(at: number | undefined) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!at || !el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (Date.now() - at > 3000) return;
    const tint = getComputedStyle(document.documentElement).getPropertyValue("--color-tint-2").trim() || "#D7E7E0";
    el.animate([{ backgroundColor: tint }, { backgroundColor: "transparent" }], { duration: 1800, easing: "ease-out" });
  }, [at]);
  return ref;
}

function Credit() {
  const a = (href: string, text: string) => (
    <a className="link" href={href} target="_blank" rel="noreferrer">{text}<span className="sr-only"> (opens in a new tab)</span></a>
  );
  return (
    <p className="text-[0.85rem] leading-relaxed text-ink-2">
      Positions from {a("https://adsb.lol/", "adsb.lol")} (ODbL) and {a("https://adsb.fi/", "adsb.fi")}, routes from {a("https://adsb.im/", "adsb.im")} (ODbL) and {a("https://github.com/vradarserver/standing-data", "Virtual Radar Server")} (CC0), airports from {a("https://ourairports.com/data/", "OurAirports")}.
    </p>
  );
}
