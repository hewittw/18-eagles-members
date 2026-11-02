"use client";
// /clubhouse/flights, "Getting there": the airport nearest each of the golfer's courses, a live board for each
// airport they follow, and a search to add one. Everything arrives through Supabase: the board is a snapshot, then
// Realtime pushes of only the rows the poll-flights worker changed. The browser never calls adsb.lol.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiState, Freshness, LivePauseNotice, PageHeader } from "@/components/golf";
import { FollowToggle } from "@/components/golf/FollowToggle";
import { PHASE_LABEL, PhaseMark, type Phase } from "@/components/golf/flights/PhaseMark";
import { Button, cx, Field, SectionHeading, Tag, TextInput } from "@/components/ui";
import { courseGeo, defaultHome } from "@/lib/courses";
import type { Course } from "@/lib/course-types";
import { useClub } from "@/lib/hooks";
import { AIRPORT_COLS, nearestAirport, searchAirports, type Airport } from "@/lib/live/airports";
import { useSupabaseBrowser } from "@/lib/live/browser";
import { MAX_AIRPORTS } from "@/lib/live/limits";
import { useWorkerHealth, type WorkerHealth, type WorkerRun } from "@/lib/live/useWorkerHealth";
import { Page } from "../../_components/Placeholder";
import { useAirportFollows, type AirportFollows } from "./useAirportFollows";
import { useFlightsLive, type FlightRow } from "./useFlightsLive";

const EVERY_SEC = 30;
const PHASES: Phase[] = ["arriving", "departing", "ground", "overhead"];
const TILE_LABEL: Record<Phase, string> = { arriving: "Arriving", departing: "Departing", ground: "On the ground", overhead: "Passing" };
const PREVIEW = 6;

export function FlightsBoard() {
  const db = useSupabaseBrowser();
  // Freshness first: it subscribes to worker_runs before any table snapshot is read.
  const health = useWorkerHealth("flights", EVERY_SEC);
  const follows = useAirportFollows(!!db);
  const codes = useMemo(() => follows.list?.map((a) => a.code) ?? null, [follows.list]);
  const live = useFlightsLive(db, codes);
  const info = useAirportInfo(db, codes);

  return (
    <Page className="grid gap-12 md:gap-16">
      <div className="grid gap-5">
        <PageHeader
          eyebrow="Getting there"
          title="Flights"
          lede="The airport nearest each of your courses, and what's moving around the ones you follow, as it happens."
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-rule py-3">
          <Freshness health={health} what="The flights board" />
          <p className="text-[0.92rem] text-ink-2">
            Live traffic within 15 nm. Data from{" "}
            <a className="link" href="https://adsb.lol/" target="_blank" rel="noreferrer">adsb.lol<span className="sr-only"> (opens in a new tab)</span></a> and{" "}
            <a className="link" href="https://adsb.fi/" target="_blank" rel="noreferrer">adsb.fi<span className="sr-only"> (opens in a new tab)</span></a>.
          </p>
        </div>
      </div>

      <NearYourCourses follows={follows} />

      <YourAirports follows={follows} live={live} info={info} health={health} />

      <AddAirport follows={follows} />

      <p className="max-w-measure text-[0.85rem] leading-relaxed text-ink-2">
        Aircraft positions from{" "}
        <a className="link" href="https://adsb.lol/" target="_blank" rel="noreferrer">adsb.lol<span className="sr-only"> (opens in a new tab)</span></a>{" "}
        (ODbL 1.0), or from{" "}
        <a className="link" href="https://adsb.fi/" target="_blank" rel="noreferrer">adsb.fi<span className="sr-only"> (opens in a new tab)</span></a>{" "}
        when adsb.lol can&apos;t answer, checked every 30 seconds for the airports golfers follow. Airport list from{" "}
        <a className="link" href="https://ourairports.com/data/" target="_blank" rel="noreferrer">OurAirports<span className="sr-only"> (opens in a new tab)</span></a>{" "}
        (public domain). Positions only: arriving and departing are read from height and climb near the field, not from a timetable.
      </p>

      <LivePauseNotice what="the flights board" />
    </Page>
  );
}

// ───────── Airport names for the followed codes ─────────

function useAirportInfo(db: ReturnType<typeof useSupabaseBrowser>, codes: string[] | null): Map<string, Airport> {
  const [info, setInfo] = useState<Map<string, Airport>>(() => new Map());
  const key = codes ? [...codes].sort().join(",") : "";
  useEffect(() => {
    if (!db || !key) return;
    let live = true;
    void db.from("airports").select(AIRPORT_COLS).in("code", key.split(",")).returns<Airport[]>().then(({ data }) => {
      if (!live || !data) return;
      setInfo((m) => { const n = new Map(m); for (const a of data) n.set(a.code, a); return n; });
    });
    return () => { live = false; };
  }, [db, key]);
  return info;
}

const placeOf = (a: Airport | undefined) => (a ? [a.city, a.country].filter(Boolean).join(", ") : "");
const spokenName = (code: string, a?: Airport) => (a ? `${code}, ${a.name}` : code);

// ───────── I. Near your courses ─────────

type Nearest = { state: "loading" } | { state: "ok"; airport: Airport; miles: number } | { state: "none" } | { state: "error" };

function NearYourCourses({ follows }: { follows: AirportFollows }) {
  const db = useSupabaseBrowser();
  const { ready, store, course } = useClub();
  const [all, setAll] = useState(false);

  // The golfer's courses: home first, then the ones they've played (latest first), then the ones they added.
  const { courses, homeSlug, unlocated } = useMemo(() => {
    const home = store.profile.homeCourse ? course(store.profile.homeCourse) : defaultHome(null, store.customCourses);
    const played = [...store.rounds].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).map((r) => course(r.courseSlug));
    const seen = new Set<string>();
    const list: Course[] = [];
    let unlocatedCount = 0;
    for (const c of [home, ...played, ...store.customCourses]) {
      if (!c || seen.has(c.slug)) continue;
      seen.add(c.slug);
      if (courseGeo(c)) list.push(c); else unlocatedCount++;
    }
    return { courses: list, homeSlug: home?.slug ?? null, unlocated: unlocatedCount };
  }, [store.profile.homeCourse, store.rounds, store.customCourses, course]);

  const [nearest, setNearest] = useState<Map<string, Nearest>>(() => new Map());
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!db) return;
    for (const c of courses) {
      if (asked.current.has(c.slug)) continue;
      asked.current.add(c.slug);
      const g = courseGeo(c)!;
      nearestAirport(db, g.lat, g.lng)
        .then((r) => setNearest((m) => new Map(m).set(c.slug, r ? { state: "ok", ...r } : { state: "none" })))
        .catch(() => { asked.current.delete(c.slug); setNearest((m) => new Map(m).set(c.slug, { state: "error" })); });
    }
  }, [db, courses]);

  const shown = all ? courses : courses.slice(0, PREVIEW);
  return (
    <section aria-labelledby="near-h" className="grid gap-5">
      <SectionHeading id="near-h" numeral="I" eyebrow="Fly in for the round" title="Near your courses" lede="The closest airport with airline service to each course you call home or have played." />
      {!ready ? (
        <ApiState kind="loading" shape="list" label="Finding the airports near your courses" />
      ) : courses.length === 0 ? (
        <ApiState kind="empty" title="None of your courses has a location yet">
          {unlocated
            ? "The courses you've added were entered by hand, without a map pin, so there's no airport to suggest. "
            : "Choose a home course or play a round, and its airport shows up here. "}
          <Link className="link" href="/clubhouse/courses">Browse the courses</Link>.
        </ApiState>
      ) : (
        <>
          <ul className="divide-y divide-rule border-y border-rule">
            {shown.map((c) => (
              <CourseAirport key={c.slug} course={c} home={c.slug === homeSlug} near={nearest.get(c.slug) ?? { state: "loading" }} follows={follows} />
            ))}
          </ul>
          {courses.length > PREVIEW && (
            <div><Button variant="quiet" size="sm" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? "Show fewer courses" : `Show all ${courses.length} courses`}</Button></div>
          )}
        </>
      )}
    </section>
  );
}

function CourseAirport({ course, home, near, follows }: { course: Course; home: boolean; near: Nearest; follows: AirportFollows }) {
  const atLimit = (follows.list?.length ?? 0) >= MAX_AIRPORTS;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-serif text-[1.2rem] font-bold leading-snug text-ink">{course.shortName || course.name}</span>
          {home && <Tag tone="gold">Home</Tag>}
        </p>
        {near.state === "loading" && <span className="mt-2 block h-4 w-48 max-w-full animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none" aria-hidden="true" />}
        {near.state === "ok" && (
          <p className="mt-0.5 text-[1rem] text-ink-2">
            <span className="sr-only">{course.shortName || course.name}: </span>
            Fly into <span className="font-numeral text-[1.1rem] font-semibold tracking-wide text-ink">{near.airport.code}</span>,{" "}
            <span className="font-numeral tabular-nums text-ink">{Math.max(1, Math.round(near.miles))} mi</span>
            <span className="block text-[0.9rem] text-pretty">{near.airport.name}</span>
          </p>
        )}
        {near.state === "none" && <p className="mt-0.5 text-[0.95rem] text-ink-2">No airport with airline service within a few hundred miles.</p>}
        {near.state === "error" && <p className="mt-0.5 text-[0.95rem] text-ink-2">Couldn&apos;t look up the nearest airport. It will try again when you come back.</p>}
      </div>
      {near.state === "ok" && (
        <FollowToggle
          label={spokenName(near.airport.code, near.airport)}
          following={follows.isFollowing(near.airport.code)}
          busy={follows.busy.has(near.airport.code)}
          disabled={atLimit && !follows.isFollowing(near.airport.code)}
          onToggle={() => follows.toggle(near.airport.code)}
        />
      )}
    </li>
  );
}

// ───────── II. Your airports ─────────

/** What the latest worker run said about one airport, read from its detail ("ORD 43 (+3 −2 ~5), SAN failed: …"). */
type Sweep =
  | { kind: "swept"; count: number }
  | { kind: "failed"; why: string }
  | { kind: "unswept" } // the run happened after the follow, but this airport wasn't among the 6 swept
  | { kind: "waiting" }; // no run since the follow yet

function sweepOf(code: string, run: WorkerRun | null, followedAt: string | undefined): Sweep {
  const d = run?.detail ?? "";
  const ok = new RegExp(`(?:^|, )${code} (\\d+) (?:[a-z]+ )?\\(`).exec(d);
  if (ok) return { kind: "swept", count: Number(ok[1]) };
  const bad = new RegExp(`(?:^|, )${code} failed: ([^,]*)`).exec(d);
  if (bad) return { kind: "failed", why: bad[1] };
  if (run && followedAt && Date.parse(run.started_at) > Date.parse(followedAt) + 1000) return { kind: "unswept" };
  return { kind: "waiting" };
}

function YourAirports({ follows, live, info, health }: { follows: AirportFollows; live: ReturnType<typeof useFlightsLive>; info: Map<string, Airport>; health: WorkerHealth }) {
  const list = follows.list;
  return (
    <section aria-labelledby="yours-h" className="grid gap-6">
      <SectionHeading
        id="yours-h"
        numeral="II"
        eyebrow="The board"
        title="Your airports"
        lede={list && list.length ? `Watching ${list.length} of ${MAX_AIRPORTS}. Arrivals first, nearest the field at the top.` : undefined}
      />
      {follows.error && list && list.length === 0 ? (
        <ApiState kind="down" title="Your airports didn't load">{follows.error}</ApiState>
      ) : list === null ? (
        <ApiState kind="loading" shape="list" label="Loading your airports" />
      ) : list.length === 0 ? (
        <ApiState
          kind="empty"
          title="You're not watching any airports yet"
          action={<FollowToggle label="ORD, Chicago O'Hare International Airport" text="Follow ORD" following={false} busy={follows.busy.has("ORD")} onToggle={() => follows.toggle("ORD")} />}
        >
          Follow the airport near one of your courses above, or find one below. Chicago O&apos;Hare is always watched, if you want to see a busy board right now.
        </ApiState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
          {list.map((f) => (
            <AirportBoard
              key={f.code}
              code={f.code}
              airport={info.get(f.code)}
              rows={live.byAirport.get(f.code) ?? []}
              loading={live.load === "loading" && !live.byAirport.has(f.code)}
              loadFailed={live.load === "error"}
              sweep={sweepOf(f.code, health.lastRun, f.since)}
              health={health}
              touched={live.touched}
              follows={follows}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Arriving and departing nearest the field first; on the ground by callsign; passing over nearest first. */
function sortRows(phase: Phase, rows: FlightRow[]): FlightRow[] {
  const d = (r: FlightRow) => r.dist_nm ?? 999;
  const name = (r: FlightRow) => r.callsign ?? r.hex;
  return [...rows].sort((a, b) => (phase === "ground" ? name(a).localeCompare(name(b)) : d(a) - d(b) || name(a).localeCompare(name(b))));
}

function AirportBoard({ code, airport, rows, loading, loadFailed, sweep, health, touched, follows }: {
  code: string; airport: Airport | undefined; rows: FlightRow[]; loading: boolean; loadFailed: boolean; sweep: Sweep; health: WorkerHealth;
  touched: Map<string, number>; follows: AirportFollows;
}) {
  const groups = useMemo(() => {
    const g = new Map<Phase, FlightRow[]>(PHASES.map((p) => [p, []]));
    for (const r of rows) g.get(r.phase)?.push(r);
    return PHASES.map((p) => ({ phase: p, rows: sortRows(p, g.get(p)!) }));
  }, [rows]);
  const held = rows.length > 0 && (health.state === "down" || health.state === "stale" || sweep.kind === "failed");
  // No counts to post until a sweep has actually looked (a quiet sweep posts zeros; waiting or failed posts dashes).
  const waiting = rows.length === 0 && (sweep.kind !== "swept" || loading);
  const titleId = `ap-${code}`;

  return (
    <article aria-labelledby={titleId} className={cx("min-w-0 overflow-hidden rounded-2xl border bg-paper-2 shadow-card", held ? "border-dashed border-rule-strong" : "border-rule")}>
      <header className="tex-locker on-green grid gap-5 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="caps text-label text-gold">{placeOf(airport) || " "}</p>
            <h3 id={titleId} className="mt-1 font-display text-[clamp(2.6rem,7vw,3.6rem)] leading-[0.95] tracking-[0.02em]">
              {code}<span className="sr-only">{airport ? `, ${airport.name}` : ""}</span>
            </h3>
            <p className="mt-1.5 font-serif text-[0.98rem] leading-snug text-paper-3" aria-hidden="true">{airport?.name ?? " "}</p>
          </div>
          <FollowToggle tone="green" label={spokenName(code, airport)} following busy={follows.busy.has(code)} onToggle={() => follows.toggle(code)} />
        </div>
        <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2" aria-label={`${code} right now`}>
          {groups.map(({ phase, rows: g }) => (
            <div key={phase} className="tile flex min-w-0 flex-col-reverse items-center justify-end gap-1 rounded-xs px-1 py-2 text-center text-ink">
              <dt className="caps text-label leading-tight text-ink-2 text-balance">{TILE_LABEL[phase]}</dt>
              <dd className="font-numeral text-[clamp(1.5rem,4vw,2rem)] font-semibold leading-none tabular-nums">{waiting ? "–" : g.length}</dd>
            </div>
          ))}
        </dl>
        {held && <p className="caps text-label text-gold">{sweep.kind === "failed" ? "Couldn’t reach the flight feeds; showing the last good update" : "Showing the last good update"}</p>}
      </header>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        {rows.length === 0 ? (
          <EmptyBoard code={code} sweep={sweep} loading={loading} loadFailed={loadFailed} />
        ) : (
          <div className="grid gap-6">
            {groups.filter((g) => g.rows.length).map((g) => (
              <PhaseGroup key={g.phase} code={code} phase={g.phase} rows={g.rows} touched={touched} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyBoard({ code, sweep, loading, loadFailed }: { code: string; sweep: Sweep; loading: boolean; loadFailed: boolean }) {
  if (loading) return <ApiState kind="loading" shape="list" label={`Loading traffic at ${code}`} />;
  if (loadFailed) return <ApiState kind="down" title="The board didn't load">Check your connection; it fills in as soon as the next update arrives.</ApiState>;
  if (sweep.kind === "swept") {
    return <ApiState kind="empty" title="Quiet skies">Nothing within 15 nm of {code} on the last check. A new arrival shows up here within 30 seconds.</ApiState>;
  }
  if (sweep.kind === "failed") {
    // A failed airport means both feeds missed it (adsb.lol first, then adsb.fi: "ORD failed: lol 429; fi timed out").
    return (
      <ApiState kind="down" title="Couldn’t reach the flight feeds">
        Neither flight feed answered for {code} on the last check. The next one tries again in 30 seconds.
      </ApiState>
    );
  }
  if (sweep.kind === "unswept") {
    return (
      <ApiState kind="empty" title="Not watched right now">
        We watch the six airports golfers follow most, and {code} isn&apos;t among them right now. It joins when one drops off.
      </ApiState>
    );
  }
  // Waiting for the first sweep: a calm runway of placeholders, not a spinner.
  return (
    <div className="grid gap-3" role="status">
      <p className="flex items-center gap-2.5 text-[0.98rem] text-ink-2">
        <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-green" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="5.5" strokeDasharray="2.2 2.4" /></svg>
        <span><span className="font-semibold text-ink">Waiting for the first check.</span> A new airport fills in within 30 seconds.</span>
      </p>
      <ul aria-hidden="true" className="grid gap-2">
        {[64, 48, 56].map((w, i) => (
          <li key={i} className="flex items-center justify-between gap-4 border-b border-dashed border-rule py-2">
            <span className="h-4 rounded-xs bg-paper-3" style={{ width: `${w}%` }} />
            <span className="h-4 w-14 rounded-xs bg-paper-3" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhaseGroup({ code, phase, rows, touched }: { code: string; phase: Phase; rows: FlightRow[]; touched: Map<string, number> }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  const id = `ph-${code}-${phase}`;
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h4 id={id} className="flex items-center gap-2 border-b border-ink pb-1.5 text-green">
        <PhaseMark phase={phase} />
        <span className="caps text-label">{PHASE_LABEL[phase]}</span>
        <span className="ml-auto font-numeral text-[1rem] font-semibold tabular-nums text-ink">{rows.length}</span>
      </h4>
      <ul className="divide-y divide-rule">
        {shown.map((r) => <FlightLi key={r.hex} r={r} flashAt={touched.get(`${r.airport}:${r.hex}`)} />)}
      </ul>
      {rows.length > PREVIEW && (
        <Button variant="quiet" size="sm" className="mt-1 -ml-3" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${rows.length}`}<span className="sr-only"> {PHASE_LABEL[phase].toLowerCase()} at {code}</span>
        </Button>
      )}
    </section>
  );
}

// Altitude is stored to the nearest 1,000 ft, so an airborne 0 means "under 500 ft" (short final, just off the runway).
const fmtAlt = (r: FlightRow) =>
  r.phase === "ground" ? "Ground" : r.alt_ft === null ? "–" : r.alt_ft === 0 ? "Under 500 ft" : `${r.alt_ft.toLocaleString("en-US")} ft`;
const fmtDist = (r: FlightRow) => (r.dist_nm === null ? "" : `${r.dist_nm} nm`);

function FlightLi({ r, flashAt }: { r: FlightRow; flashAt: number | undefined }) {
  const ref = useFlash<HTMLLIElement>(flashAt);
  const who = [r.airline, r.aircraft_type].filter(Boolean).join(" · ");
  return (
    <li ref={ref} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2.5">
      <div className="min-w-0">
        <span className="font-numeral text-[1.18rem] font-semibold leading-tight tracking-[0.04em] text-ink">{r.callsign ?? r.hex.toUpperCase()}</span>
        <span className="block truncate text-[0.9rem] text-ink-2">{who || "Operator not listed"}</span>
      </div>
      <div className="text-right font-numeral tabular-nums leading-tight">
        <span className="block text-[1.05rem] text-ink">{fmtAlt(r)}</span>
        <span className="block text-[0.9rem] text-ink-2">{fmtDist(r)}<span className="sr-only">{r.dist_nm !== null ? " from the field" : ""}</span></span>
      </div>
    </li>
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

// ───────── III. Add an airport ─────────

type Search = { q: string; state: "idle" | "loading" | "done" | "error"; results: Airport[] };

function AddAirport({ follows }: { follows: AirportFollows }) {
  const db = useSupabaseBrowser();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ q: "", state: "idle", results: [] });
  const count = follows.list?.length ?? 0;
  const atLimit = count >= MAX_AIRPORTS;

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

  const active = query.trim().length >= 2;
  const view = active ? search : { q: "", state: "idle" as const, results: [] };
  return (
    <section aria-labelledby="add-h" className="grid gap-5">
      <SectionHeading id="add-h" numeral="III" eyebrow="Anywhere with airline service" title="Add an airport" lede={`Follow up to ${MAX_AIRPORTS}. ${count ? `You're watching ${count}.` : ""}`} />
      <div className="max-w-xl">
        <Field label="Find an airport" hint="A code, a city, or a name: SAN, Monterey, Heathrow.">
          {(a) => (
            <TextInput {...a} type="search" autoComplete="off" spellCheck={false} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Airport code, city or name" />
          )}
        </Field>
      </div>
      <p className="sr-only" aria-live="polite">
        {view.state === "done" ? (view.results.length ? `${view.results.length} airport${view.results.length === 1 ? "" : "s"} found.` : "No airports found.") : ""}
      </p>
      {atLimit && <p id="limit-note" className="text-[0.95rem] text-ink-2">You&apos;re following {MAX_AIRPORTS} airports, the most we watch. Unfollow one above to add another.</p>}
      {view.state === "loading" && view.results.length === 0 && <ApiState kind="loading" shape="list" label="Searching airports" />}
      {view.state === "error" && <ApiState kind="down" title="The search didn't go through">Check your connection and try again.</ApiState>}
      {view.state === "done" && view.results.length === 0 && (
        <ApiState kind="empty" title={`No airport matches “${view.q}”`}>
          We list airports with airline service. Try the nearest city, or the three-letter code.
        </ApiState>
      )}
      {view.results.length > 0 && view.state !== "error" && (
        <ul className={cx("max-w-3xl divide-y divide-rule border-y border-rule", view.state === "loading" && "opacity-60")}>
          {view.results.map((a) => {
            const on = follows.isFollowing(a.code);
            return (
              <li key={a.code} className="grid grid-cols-[3.6rem_minmax(0,1fr)_auto] items-center gap-x-3 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-x-4">
                <span className="font-display text-[1.7rem] leading-none text-ink sm:text-[2rem]">{a.code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-medium text-ink">{a.name}</span>
                  <span className="block truncate text-[0.9rem] text-ink-2">{placeOf(a)}</span>
                </span>
                <FollowToggle
                  label={spokenName(a.code, a)}
                  following={on}
                  busy={follows.busy.has(a.code)}
                  disabled={atLimit && !on}
                  describedBy={atLimit && !on ? "limit-note" : undefined}
                  onToggle={() => follows.toggle(a.code)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
