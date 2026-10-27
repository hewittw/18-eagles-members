"use client";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { placeOf } from "@/components/golf";
import { Button, ButtonLink, focusInvalid, Icon, SkipTo, TextInput, ToggleChip } from "@/components/ui";
import type { Course } from "@/lib/course-types";
import { useClub } from "@/lib/hooks";
import { withSampleSeason } from "@/lib/sample";
import { byClubOrder, patchProfile, update } from "@/lib/store";
import type { Club } from "@/lib/types";

// The first visit's setup: three short questions answered on the Clubhouse itself (no wizard, no tour).
// Each answer is saved the moment it's given, and the next question takes its place. Then the golfer plays.

export const SETUP = ["Your index", "Home course", "Your bag"] as const;

/** Where the golfer is in setup: 0 = index, 1 = home course, 2 = bag, 3 = done. */
export function setupStep(store: ReturnType<typeof useClub>["store"]) {
  if (store.rounds.length > 0) return 3;
  if (store.profile.welcomedAt == null) return 0;
  if (!store.profile.homeCourse) return 1;
  if (store.profile.bagSetAt == null) return 2;
  return 3;
}

// Each answer replaces its question in place, so a quick second tap (a double tap, an impatient tap) would land on
// whatever took its place: the bag's Continue sits exactly where the home course's did. Pointer clicks in the first
// moments after a step changes are dropped; keyboard clicks (detail 0) always go through.
let ghostUntil = 0;
let ghostGuard = false;
function dropGhostClick(e: MouseEvent) {
  if (e.detail > 0 && performance.now() < ghostUntil) {
    e.preventDefault();
    e.stopPropagation();
  }
}

/**
 * The element with this id that's on screen. The router keeps pages it has shown mounted but hidden, so a plain
 * getElementById can find a hidden copy that can't take focus.
 */
export function visibleById(id: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(`[id="${id}"]`)).find((e) => e.getClientRects().length > 0) ?? null;
}

/** Move focus to the next question's heading once it replaces the one just answered. */
export function focusHeading(...ids: string[]) {
  ghostUntil = performance.now() + 450;
  if (!ghostGuard) {
    ghostGuard = true;
    document.addEventListener("click", dropGhostClick, true);
    document.addEventListener("mousedown", dropGhostClick, true); // nor does it move focus off the new heading
  }
  requestAnimationFrame(() => {
    const h = ids.map(visibleById).find(Boolean);
    if (!h) return;
    h.tabIndex = -1;
    h.style.outline = "none";
    h.focus();
  });
}

/** Reopen an answered step. Later answers are kept, so going back never loses anything. */
let lastHome: string | null = null; // the pick before "Back", so the course step reopens with it selected

export function reopenStep(i: number, homeCourse?: string | null) {
  if (homeCourse) lastHome = homeCourse;
  if (i === 0) {
    patchProfile({ welcomedAt: null });
    focusHeading("index-q");
  } else if (i === 1) {
    patchProfile({ homeCourse: null });
    focusHeading("setup-home");
  }
}

/** Three steps as a row of numbered pills: done ones ticked, the current one filled. For the green hero. */
export function SetupSteps({ step, homeCourse }: { step: number; homeCourse?: string | null }) {
  return (
    <div className="min-w-0 justify-self-start md:justify-self-end">
      {/* Phones: one compact line, so the step's question sits near the top of the screen. The step itself has its
          own Back button, so "Change" lives in the full list from md. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:hidden">
        <p className="caps text-label text-gold">
          Step {Math.min(step, 2) + 1} of 3<span className="text-paper-3"> · {SETUP[Math.min(step, 2)]}</span>
        </p>
        <ol className="flex items-center gap-1.5" aria-hidden="true">
          {SETUP.map((label, i) => (
            <li key={label} className={`h-2 rounded-full ${i < step ? "w-5 bg-gold" : i === step ? "w-8 bg-on-green" : "w-5 border border-white/60"}`} />
          ))}
        </ol>
      </div>
      <p className="caps text-label text-gold max-md:hidden">Set up your locker</p>
      <ol className="mt-3 grid gap-2 max-md:hidden">
        {SETUP.map((label, i) => {
          const done = i < step;
          const now = i === step;
          return (
            <li key={label} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${now ? "bg-white/12 ring-1 ring-gold/70" : ""}`} aria-current={now ? "step" : undefined}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full font-numeral text-base font-semibold ${done ? "bg-gold text-green-3" : now ? "bg-on-green text-green-3" : "border border-white/50 text-on-green"}`} aria-hidden="true">
                {done ? "✓" : i + 1}
              </span>
              {done ? (
                <button type="button" onClick={() => reopenStep(i, homeCourse)} className="-my-2 flex min-h-tap flex-1 items-center justify-between gap-3 rounded-md px-2 text-left text-[1rem] font-semibold text-on-green transition-colors is-hover:bg-white/10">
                  <span>{label}<span className="sr-only">, done.</span></span>{" "}
                  <span className="text-[0.85rem] font-medium text-paper-3 underline-offset-2">Change<span className="sr-only"> {label.toLowerCase()}</span></span>
                </button>
              ) : (
                <>
                  <span className="text-[1rem] font-semibold text-on-green">{label}</span>
                  <span className="sr-only">{now ? ", current step" : ", to do"}</span>
                </>
              )}
            </li>
          );
        })}
        <li className="flex items-center gap-3 px-3 py-2.5 text-on-green">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-white/50" aria-hidden="true">
            <Icon name="flag" className="size-4" />
          </span>
          <span className="text-[1rem]">Then play your first hole</span>
        </li>
      </ol>
    </div>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="-ml-1 mb-4 inline-flex min-h-tap items-center gap-1.5 rounded-full bg-tint py-1 pl-2.5 pr-4 text-[0.95rem] font-semibold text-green transition-[background-color,transform] duration-150 is-hover:bg-tint-2 is-pressed:scale-[0.98]">
      <svg viewBox="0 0 10 16" className="h-4 w-2.5 shrink-0" aria-hidden="true"><path d="M8 2 L2 8 L8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {children}
    </button>
  );
}

// ───────────────────────── step 2: the home course ─────────────────────────
export function HomeCourseStep() {
  const { courses, store } = useClub();
  const [q, setQ] = useState("");
  // Coming back to this step keeps the earlier pick (it's cleared from the profile, not forgotten here).
  const [pick, setPick] = useState<string | null>(() => store.profile.homeCourse ?? lastHome);
  const [error, setError] = useState<string | undefined>();
  const [all, setAll] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const ordered = [...courses].sort((a, b) => Number(b.tags.includes("home")) - Number(a.tags.includes("home")) || a.name.localeCompare(b.name));
    return s ? ordered.filter((c) => `${c.name} ${c.shortName} ${c.city} ${c.region} ${c.country}`.toLowerCase().includes(s)) : ordered;
  }, [courses, q]);

  const save = () => {
    if (!pick) {
      setError("Choose the course you play most, or add yours.");
      // The first tile reads its group's error; with no tiles showing (a search with no match), the search box does.
      focusInvalid(Array.from(document.querySelectorAll<HTMLInputElement>("input[name=home-course]")).find((e) => e.closest("label")?.getClientRects().length) ?? visibleById("home-q"));
      return;
    }
    patchProfile({ homeCourse: pick });
    focusHeading("setup-bag");
  };

  return (
    <section aria-labelledby="setup-home" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <BackButton onClick={() => reopenStep(0, pick)}>Back to your index</BackButton>
        <p className="caps text-label text-gold-ink">Step 2 of 3</p>
        <h2 id="setup-home" className="mt-1 text-balance font-display text-display-2 text-ink">Where do you usually play?</h2>
        <p className="mt-3 max-w-measure font-serif text-lede text-ink-2">Your home course opens ready to play each time, with its tees, pars and yardages. You can play any course whenever you like.</p>
      </div>

      <div className="max-w-md">
        <label htmlFor="home-q" className="mb-2 block text-[1rem] font-medium text-ink">Search courses</label>
        <div className="relative">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M13 13 L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <TextInput id="home-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or place" className="rounded-full! bg-paper-3! pl-11!" autoComplete="off" enterKeyHint="search" onKeyDown={(e) => { if (e.key === "Enter" && list.length === 1) { setPick(list[0].slug); lastHome = list[0].slug; setError(undefined); } }} aria-describedby={error && !list.length ? "home-err" : undefined} />
        </div>
      </div>

      <fieldset role="radiogroup" aria-describedby={error ? "home-err" : undefined} aria-invalid={error ? true : undefined}>
        <legend className="sr-only">Your home course</legend>
        <p className="caps mb-3 text-label text-ink-2" role="status" aria-live="polite">{q.trim() ? `${list.length} ${list.length === 1 ? "course matches" : "courses match"}` : all ? `All ${list.length} courses` : "Suggested courses"}</p>
        {error && (
          <p id="home-err" className="mb-3 flex items-center gap-2 font-medium text-error">
            <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 5.5 V11 M10 13.5 V14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            {error}
          </p>
        )}
        {list.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(all || q.trim() ? list : list.slice(0, 8)).map((c) => (
              <li key={c.slug} className="min-w-0">
                <CourseRadio course={c} checked={pick === c.slug} describedBy={error ? "home-err" : undefined} onPick={() => { setPick(c.slug); lastHome = c.slug; setError(undefined); }} />
              </li>
            ))}
          </ul>
        ) : null}
        {!all && !q.trim() && list.length > 8 && (
          <Button
            className="mt-4"
            onClick={() => {
              setAll(true);
              // The button goes away: put focus on the first course it revealed, where the button was.
              requestAnimationFrame(() => document.querySelectorAll<HTMLInputElement>("input[name=home-course]")[8]?.focus());
            }}
          >
            Show all {list.length} courses
          </Button>
        )}
        {!list.length && (
          <p className="rounded-xl bg-paper-3 p-5 text-ink-2">No course matches “{q}”. Add it below and it becomes your home course.</p>
        )}
      </fieldset>


      <div>
        <ButtonLink href="/clubhouse/courses/new?then=home" icon={<Icon name="plus" className="size-5" />}>My course isn&apos;t here</ButtonLink>
      </div>

      {/* The action bar keeps one shape whatever is picked: the choice on the left (one line, cut short if long), a
          fixed button on the right. On phones it sits exactly on the tab bar; from md it's inline. */}
      <ActionBar
        label="Home course"
        value={pick ? (courses.find((c) => c.slug === pick)?.shortName ?? "") : "Pick one above"}
        muted={!pick}
      >
        <Button variant="primary" size="lg" onClick={save} className="w-40 shrink-0 whitespace-nowrap sm:w-48">Continue</Button>
      </ActionBar>
    </section>
  );
}

function CourseRadio({ course, checked, describedBy, onPick }: { course: Course; checked: boolean; describedBy?: string; onPick: () => void }) {
  return (
    <label className="group/cr relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card transition-[transform,box-shadow] duration-150 is-pressed:scale-[0.98] has-checked:border-green has-checked:ring-2 has-checked:ring-green has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
      {/* Centred in the tile: a tap focuses the radio (Chrome), and the browser scrolls a focused element clear of the
          scroll padding. At the tile's top edge that moved a tile half under the header; at its centre it stays put. */}
      <input type="radio" name="home-course" value={course.slug} checked={checked} onChange={onPick} aria-describedby={describedBy} className="sr-only left-1/2 top-1/2" />
      <span className="relative block aspect-[16/10] bg-tint">
        {/* Augusta is also the hero photo; eager here too, so both copies of it load the same way. */}
        {course.hero ? (
          <Image src={course.hero.src} alt="" fill loading={course.slug === "augusta-national" ? "eager" : undefined} sizes="(max-width: 640px) 50vw, 260px" className="object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-green"><Icon name="flag" className="size-8" /></span>
        )}
        <span className={`absolute right-2 top-2 grid size-7 place-items-center rounded-full border-2 ${checked ? "border-on-green bg-green text-on-green" : "border-white bg-black/25"}`} aria-hidden="true">
          {checked && <svg viewBox="0 0 16 16" className="size-4"><path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
      </span>
      <span className="flex flex-1 flex-col p-3">
        <span className="line-clamp-2 font-serif text-[1.05rem] leading-snug text-ink">{course.shortName}</span>
        <span className="mt-0.5 line-clamp-2 text-sm text-ink-2">{placeOf(course)}</span>
      </span>
    </label>
  );
}

// ───────────────────────── step 3: the bag ─────────────────────────
const KINDS: { kind: Club["kind"]; label: string }[] = [
  { kind: "wood", label: "Woods" },
  { kind: "hybrid", label: "Hybrids" },
  { kind: "iron", label: "Irons" },
  { kind: "wedge", label: "Wedges" },
  { kind: "putter", label: "Putter" },
];

export function BagStep() {
  const { store } = useClub();
  const bag = store.bag;
  const inBag = bag.filter((c) => c.inBag).length;
  const [error, setError] = useState<string | undefined>();
  const save = () => {
    if (!inBag) {
      setError("Put at least a putter in the bag.");
      return;
    }
    patchProfile({ bagSetAt: Date.now() });
    focusHeading("tee-off");
  };
  return (
    <section aria-labelledby="setup-bag" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <BackButton onClick={() => reopenStep(1, store.profile.homeCourse)}>Back to your home course</BackButton>
        <p className="caps text-label text-gold-ink">Step 3 of 3</p>
        <h2 id="setup-bag" className="mt-1 text-balance font-display text-display-2 text-ink">What&apos;s in your bag?</h2>
        <p className="mt-3 max-w-measure font-serif text-lede text-ink-2">These become the club buttons on every hole: tap the club you hit, and the shots count your score. A standard set is filled in; tap a club to take it out or put it in.</p>
      </div>
      <div className="-my-3 empty:hidden"><SkipTo href="#bag-save">Skip the clubs to Continue</SkipTo></div>
      <div className="overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card">
        <p className="flex items-center justify-between gap-3 border-b border-rule/80 bg-paper-3 px-4 py-2.5 sm:px-5" role="status" aria-live="polite">
          <span className="caps text-label text-ink-2">In the bag</span>{" "}
          <span className={`font-numeral text-lg font-semibold tabular-nums ${inBag > 14 ? "text-error" : "text-ink"}`}>{inBag} of 14 allowed</span>
        </p>
        <div className="divide-y divide-rule/80">
          {KINDS.map(({ kind, label }) => {
            const clubs = bag.filter((c) => c.kind === kind).sort(byClubOrder);
            if (!clubs.length) return null;
            return (
              <div key={kind} className="px-4 py-3.5 sm:px-5" role="group" aria-labelledby={`sb-${kind}`}>
                <h3 id={`sb-${kind}`} className="font-semibold text-ink">{label}</h3>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {clubs.map((c) => (
                    <li key={c.id}>
                      <ToggleChip pressed={c.inBag} onPressedChange={(p) => { setError(undefined); update((s) => ({ ...s, bag: s.bag.map((x) => (x.id === c.id ? { ...x, inBag: p } : x)) })); }}>
                        {c.name}
                      </ToggleChip>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      {inBag > 14 && <p className="text-ink-2">The Rules allow 14 clubs. That&apos;s fine for practice; take some out before a competition.</p>}
      {error && <p id="bag-err" className="font-medium text-error" role="alert">{error}</p>}
      <ActionBar label="In the bag" value={`${inBag} ${inBag === 1 ? "club" : "clubs"}`}>
        <Button id="bag-save" variant="primary" size="lg" onClick={save} className="w-40 shrink-0 whitespace-nowrap sm:w-48" aria-describedby={error ? "bag-err" : undefined}>Continue</Button>
      </ActionBar>
    </section>
  );
}

/** A setup step's bottom bar: what's chosen on the left, the next step's button on the right. Same size every time. */
function ActionBar({ label, value, muted, children }: { label: string; value: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div data-obscures className="sticky bottom-[calc(var(--tabbar)+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center gap-4 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-xl md:border md:border-rule/70 md:bg-paper-2 md:p-4 md:shadow-card">
      <p className="min-w-0 flex-1" aria-live="polite">
        <span className="caps block truncate text-[0.7rem] text-ink-2">{label}</span>
        <span className={`block truncate font-serif text-[1.05rem] leading-snug ${muted ? "text-ink-2" : "text-ink"}`}>{value}</span>
      </p>
      {children}
    </div>
  );
}

// ───────────────────────── step 0: the name (the very first screen) ─────────────────────────
/**
 * The first thing a brand-new golfer sees, and the only thing: one question, full screen. A native modal <dialog>
 * keeps the rest of the page inert (no tabbing into the nav behind it) and Escape can't skip it.
 */
export function NameGate({ photo }: { photo: { src: string } | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Prefilled with the first name on the account (still the golfer's to change), so the first screen already knows them.
  const { user } = useUser();
  const [name, setName] = useState(() => user?.firstName?.trim() ?? "");
  const [error, setError] = useState<string | undefined>();
  const saved = useRef(false);
  const typed = useRef(false);
  const accountName = user?.firstName?.trim() ?? "";
  useEffect(() => {
    // If Clerk's user arrives after the screen opens, fill it in once, never over what someone has typed.
    if (accountName && !typed.current) setName((n) => n || accountName);
  }, [accountName]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    // No scroll on focus: on a short screen (a phone on its side) the heading stays in view above the field.
    input.current?.focus({ preventScroll: true });
    // Chrome closes a modal on a second Escape even when "cancel" is prevented. Without a name there's nothing behind
    // it yet, so open it again with focus back in the field (the button is the one way forward).
    const reopen = () => {
      if (saved.current) return;
      d.showModal();
      input.current?.focus({ preventScroll: true });
    };
    d.addEventListener("close", reopen);
    return () => d.removeEventListener("close", reopen);
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = name.trim().replace(/\s+/g, " ");
    const err = !v ? "Type your name, or what your playing partners call you." : v.length > 30 ? `Keep it to 30 characters (that's ${v.length}).` : undefined;
    if (err) {
      setError(err);
      focusInvalid(input.current);
      return;
    }
    saved.current = true;
    ref.current?.close();
    patchProfile({ name: v });
    focusHeading("index-q");
  };
  // "Just looking?": straight into the sample season, no name needed (greetings read "Welcome back." without one).
  const explore = () => {
    saved.current = true;
    ref.current?.close();
    update((s) => withSampleSeason(s));
    focusHeading("hero-title");
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby="name-q"
      onCancel={(e) => e.preventDefault()}
      className="on-green fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-green-3 p-0 text-on-green backdrop:bg-green-3"
    >
      {/* Fixed to the viewport, so the photo and its wash stay behind everything however far the dialog scrolls. */}
      {photo && (
        <div aria-hidden="true" className="fixed inset-0">
          <Image src={photo.src} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_72_50/0.82)_0%,rgb(0_88_61/0.93)_60%,rgb(0_72_50/0.97)_100%)]" />
        </div>
      )}
      <div className="relative mx-auto grid min-h-dvh max-w-xl content-center px-6 py-16 [@media(max-height:32rem)]:py-6">
        <span className="grid size-16 place-items-center rounded-full border-2 border-gold font-display text-3xl text-gold [@media(max-height:32rem)]:hidden" aria-hidden="true">E</span>
        <p className="caps mt-8 text-label text-gold [@media(max-height:32rem)]:mt-0">Welcome to 18 Eagles</p>
        <p className="mt-2 max-w-md text-pretty font-serif text-paper-3">A golf journal that keeps every card you play and works out your handicap from them.</p>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6 [@media(max-height:32rem)]:mt-4 [@media(max-height:32rem)]:gap-4">
          <h1 id="name-q" className="text-balance font-display text-display-1 text-on-green">
            <label htmlFor="golfer-name">What should we call you?</label>
          </h1>
          <p id="golfer-name-hint" className="-mt-2 max-w-md font-serif text-lede text-paper-3">Your name goes on your locker, your cards and your trophies. It&apos;s private to your account.</p>
          <div>
            <input
              ref={input}
              id="golfer-name"
              name="name"
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="go"
              maxLength={40}
              value={name}
              onChange={(e) => { typed.current = true; setName(e.target.value); if (error) setError(undefined); }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "golfer-name-err golfer-name-hint" : "golfer-name-hint"}
              placeholder="Your name"
              className="min-h-tile w-full rounded-lg border-2 border-white/70 bg-white px-4 font-serif text-2xl text-ink placeholder:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold aria-invalid:border-gold"
            />
            {error && (
              <p id="golfer-name-err" className="mt-2 flex items-center gap-2 font-medium text-gold">
                <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 5.5 V11 M10 13.5 V14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                {error}
              </p>
            )}
          </div>
          <Button type="submit" variant="primary" tone="green" size="lg" block>Open my locker</Button>
        </form>
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-1 text-center text-paper-3">
          Just looking?
          <Button variant="quiet" tone="green" size="sm" onClick={explore}>Explore a sample season</Button>
        </p>
      </div>
    </dialog>
  );
}
