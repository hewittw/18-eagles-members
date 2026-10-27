"use client";
import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/golf";
import { ActionList, ActionRow, Button, ButtonLink, Callout, ChoiceGroup, ConfirmDialog, Field, focusInvalid, NumberInput, SectionHeading, Select, TextInput, ToggleChip, useToast } from "@/components/ui";
import { formatIndex } from "@/lib/handicap";
import { useClub } from "@/lib/hooks";
import { withSampleSeason } from "@/lib/sample";
import { honors } from "@/lib/stats";
import { byClubOrder, exportJSON, importJSON, patchProfile, resetAll, todayISO, update } from "@/lib/store";
import type { ClubKind, Goal } from "@/lib/types";
import { parseIndex } from "@/lib/validate";
import { Page, Placeholder } from "../_components/Placeholder";
import { useTrophies } from "../_components/TrophyCase";
import { visibleById } from "../_components/Onboarding";

const KINDS: { kind: ClubKind; label: string }[] = [
  { kind: "wood", label: "Woods" },
  { kind: "hybrid", label: "Hybrids" },
  { kind: "iron", label: "Irons" },
  { kind: "wedge", label: "Wedges" },
  { kind: "putter", label: "Putter" },
];

const GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: "100", label: "Break 100", hint: "99 or better" },
  { value: "90", label: "Break 90", hint: "89 or better" },
  { value: "80", label: "Break 80", hint: "79 or better" },
  { value: "scratch", label: "Scratch", hint: "Index 0.0" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
};

export function Locker() {
  const { ready, store, handicap, courses } = useClub();
  const router = useRouter();
  const toast = useToast();
  const [indexText, setIndexText] = useState<string | null>(null); // null = show the saved value
  const [indexError, setIndexError] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [dialog, setDialog] = useState<"sample" | "erase" | null>(null);
  const trophies = useTrophies();
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [leaving, setLeaving] = useState(false);
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!ready) return <Placeholder label="Opening your locker" />;

  const { profile, bag } = store;
  const inBag = bag.filter((c) => c.inBag).length;
  const earned = honors(store.rounds, store.customCourses, handicap.history);
  const countedRounds = new Set(handicap.differentials.flatMap((d) => d.roundIds)).size;
  const shownIndex = indexText ?? (profile.enteredIndex != null ? formatIndex(profile.enteredIndex) : "");
  const goal = GOALS.find((g) => g.value === profile.goal);

  function saveIndex(e: FormEvent) {
    e.preventDefault();
    if (!shownIndex.trim()) {
      setIndexError("Enter your Handicap Index, like 12.4. To go without one, use “Remove my index”.");
      focusInvalid(visibleById("l-index"));
      return;
    }
    const r = parseIndex(shownIndex);
    if (r.error) {
      setIndexError(r.error);
      focusInvalid(visibleById("l-index"));
      return;
    }
    setIndexError(undefined);
    setIndexText(null);
    patchProfile({ enteredIndex: r.value, welcomedAt: profile.welcomedAt ?? Date.now() });
    toast({ message: `Index saved: ${formatIndex(r.value)}` });
  }

  function exportData() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `18-eagles-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ message: "Saved a copy to your downloads" });
  }

  async function importData(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const before = exportJSON();
    const err = importJSON(await file.text());
    setImportError(err ?? undefined);
    if (err) {
      focusInvalid(visibleById("l-import"));
      return;
    }
    setIndexText(null);
    toast({ message: `Imported ${file.name}`, action: { label: "Undo", onClick: () => importJSON(before) } });
  }

  return (
    <Page>
      <PageHeader eyebrow="The bag and your settings" title={profile.name ? `${profile.name}\u2019s locker` : "Locker"} />

      {/* The locker door: a brass nameplate with the essentials */}
      <div className="tex-locker on-green mt-6 overflow-hidden rounded-2xl border border-green-3 px-5 py-7 shadow-card sm:px-10 sm:py-9">
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-10">
          <div className="grid grid-cols-6 gap-1.5 sm:hidden" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-1.5 rounded-full bg-black/35" />)}
          </div>
          {/* Brushed brass: a warm gold sweep (never the flat Brass token), an engraved rule inset from the edge,
              a bevel of light on top and shade below. Text is Deep Green: 4.55:1 at the darkest corner stop
              (#c49a42), 8:1+ across the bright middle where the words sit. */}
          <div
            className="relative rounded-lg px-10 py-5 text-center text-[#00402B] [text-shadow:0_1px_0_rgb(255_255_255/0.35)]"
            style={{
              background: "linear-gradient(135deg, #c9a24a 0%, #e9cf85 30%, #f4e2a2 48%, #dcbc66 68%, #c49a42 100%)",
              boxShadow: "inset 0 1px 0 rgb(255 255 255 / .6), inset 0 -1px 0 rgb(90 64 18 / .45), 0 2px 0 #7a5a1e, 0 8px 18px rgb(0 0 0 / .32)",
            }}
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-[7px] rounded-[5px] border border-[#8a6a2c]/60 shadow-[0_1px_0_rgb(255_255_255/0.45),inset_0_1px_0_rgb(255_255_255/0.45)]" />
            <Screw className="left-3.5 top-1/2 -translate-y-1/2" />
            <Screw className="right-3.5 top-1/2 -translate-y-1/2" />
            <p className="caps text-[0.75rem] tracking-[0.3em]">{profile.name ? `${profile.name} · Locker No. 18` : "Locker No. 18"}</p>
            <p className="mt-1 font-display text-[2.1rem] leading-none uppercase tracking-[0.06em]">
              {handicap.display != null ? formatIndex(handicap.display) : "No index yet"}
            </p>
            <p className="mt-1.5 font-serif text-[0.95rem] italic">
              {handicap.source === "computed" ? `Calculated from ${countedRounds} rounds` : handicap.source === "entered" ? "Handicap Index, as entered" : `${handicap.roundsToFirst} rounds to your first index`}
            </p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-white/20 text-center sm:grid-cols-1 sm:divide-x-0 sm:divide-y sm:text-left">
            <div className="px-2 sm:px-0 sm:pb-3"><dt className="caps whitespace-nowrap text-[0.7rem] text-gold sm:text-label">In the bag</dt><dd className="mt-0.5 font-numeral text-[1.5rem] font-semibold tabular-nums">{inBag} clubs</dd></div>
            <div className="px-2 sm:px-0 sm:py-3"><dt className="caps text-label text-gold">Goal</dt><dd className="mt-0.5 whitespace-nowrap font-numeral text-[1.5rem] font-semibold max-[25rem]:text-[1.25rem]">{goal ? goal.label : "None yet"}</dd></div>
            <div className="px-2 sm:px-0 sm:pt-3"><dt className="caps text-label text-gold">Honors</dt><dd className="mt-0.5 font-numeral text-[1.5rem] font-semibold tabular-nums">{earned.length}</dd></div>
          </dl>
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-10">
        {/* The bag */}
        <section aria-labelledby="bag-h" className="min-w-0">
          <SectionHeading id="bag-h" title="Your bag" lede="The clubs you carry become the club buttons on the hole screen. Tap one to take it out or put it back." />
          {inBag > 14 && (
            <Callout className="mt-4" tone="gold" title="One over the limit">
              The Rules allow 14 clubs; you have {inBag}. Take {inBag - 14 === 1 ? "one" : inBag - 14} out before a competition.
            </Callout>
          )}
          {inBag === 0 && (
            <Callout className="mt-4" title="An empty bag">Put at least a putter back in, so the hole screen has clubs to tap.</Callout>
          )}
          <Group caption={<span role="status" aria-live="polite">{inBag} of {bag.length} clubs in the bag</span>} className="mt-6">
            {KINDS.map(({ kind, label }) => {
              const clubs = bag.filter((c) => c.kind === kind).sort(byClubOrder);
              if (!clubs.length) return null;
              return (
                <div key={kind} className="min-w-0 px-4 py-3.5 sm:px-5" role="group" aria-labelledby={`k-${kind}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 id={`k-${kind}`} className="font-semibold text-ink">{label}</h3>
                    <span className="font-numeral text-[0.95rem] tabular-nums text-ink-2">{clubs.filter((c) => c.inBag).length} of {clubs.length} in</span>
                  </div>
                  <ul className="mt-2.5 flex flex-wrap gap-1.5" role="list">
                    {clubs.map((c) => (
                      <li key={c.id}>
                        <ToggleChip
                          pressed={c.inBag}
                          onPressedChange={(p) => update((s) => ({ ...s, bag: s.bag.map((x) => (x.id === c.id ? { ...x, inBag: p } : x)) }))}
                        >
                          {c.name}
                        </ToggleChip>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Group>
        </section>

        {/* Handicap and goal */}
        <section aria-labelledby="hcp-h" className="min-w-0">
          <SectionHeading id="hcp-h" title="Handicap and goal" lede="What your index starts from, what you're playing for, and where you tee off." />
          <Group caption="Handicap Index" className="mt-6">
            <form noValidate onSubmit={saveIndex} className="grid gap-3 p-4 sm:p-5">
              <Field
                id="l-index"
                label="Your Handicap Index"
                hint="From your GHIN or club card, like 12.4. A plus handicap is written +1.2."
                error={indexError}
              >
                {(a) => (
                  <NumberInput
                    {...a}
                    decimal
                    inputMode="text"
                    pattern={undefined}
                    value={shownIndex}
                    onChange={(e) => { setIndexText(e.target.value); if (indexError) setIndexError(undefined); }}
                    className="max-w-[10rem]"
                  />
                )}
              </Field>
              <p className="text-[0.95rem] text-ink-2">
                {handicap.source === "computed" ? (
                  <>The index you see is <strong className="font-medium text-ink">calculated from {countedRounds} rounds</strong>: {formatIndex(handicap.index)}. The one you enter here is kept for reference only.</>
                ) : handicap.source === "entered" ? (
                  <>The index you see is <strong className="font-medium text-ink">as entered</strong>. After {handicap.roundsToFirst} more {handicap.roundsToFirst === 1 ? "round" : "rounds"} it’s calculated from your cards.</>
                ) : (
                  <>No index yet. Enter one, or post {handicap.roundsToFirst} rounds and it’s calculated from your cards.</>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button id="l-index-save" type="submit" variant="primary">Save index</Button>
                {profile.enteredIndex != null && (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      const was = profile.enteredIndex;
                      patchProfile({ enteredIndex: null });
                      setIndexText(null);
                      setIndexError(undefined);
                      toast({ message: "Removed your entered index", action: { label: "Undo", onClick: () => patchProfile({ enteredIndex: was }) } });
                      // This button goes away; keep keyboard focus in the form, on its button (focusing the field
                      // would open a phone's keyboard for a tap that typed nothing).
                      visibleById("l-index-save")?.focus();
                    }}
                  >
                    Remove my index
                  </Button>
                )}
              </div>
            </form>
          </Group>

          <Group caption="Playing for" className="mt-8">
            <div className="p-4 sm:p-5">
              <ChoiceGroup
                legend="Your goal"
                hideLegend
                hint="Saved when you choose. The Clubhouse and Stats measure your progress against it."
                layout="grid"
                value={profile.goal}
                onChange={(g) => { patchProfile({ goal: g }); toast({ message: `Goal saved: ${GOALS.find((x) => x.value === g)?.label}` }); }}
                options={GOALS}
              />
            </div>
          </Group>

          <Group caption="Your name" className="mt-8">
            <NameForm key={profile.name ?? ""} name={profile.name} onSaved={(n) => toast({ message: `Saved. Welcome, ${n}.` })} />
          </Group>
          <Group caption="Home course" className="mt-8">
            <div className="p-4 sm:p-5">
              <Field label="Home course" hideLabel hint="Chosen for you on the Clubhouse Tee off card.">
                {(a) => (
                  <Select
                    {...a}
                    value={profile.homeCourse ?? ""}
                    onChange={(e) => { patchProfile({ homeCourse: e.target.value || null }); toast({ message: `Home course: ${courses.find((c) => c.slug === e.target.value)?.name ?? "none"}` }); }}
                  >
                    {!profile.homeCourse && <option value="">Choose a course</option>}
                    {[...courses].sort((x, y) => x.name.localeCompare(y.name)).map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Group>
        </section>
      </div>

      {/* Honors */}
      <section aria-labelledby="hon-h" className="mt-14">
        <SectionHeading id="hon-h" title="Honors" lede="Small milestones, earned on the course and kept here." />
        <div className="tex-locker on-green mt-6 rounded-2xl border border-green-3 p-3 shadow-card sm:p-6">
          {earned.length ? (
            <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4" role="list">
              {earned.map((h) => (
                <li key={h.id} className="brass-plate relative flex flex-col justify-center rounded-lg px-4 py-4 text-center sm:px-8">
                  <Screw className="left-1.5 top-1.5 sm:left-2 sm:top-2" />
                  <Screw className="right-1.5 top-1.5 sm:right-2 sm:top-2" />
                  <Screw className="bottom-1.5 left-1.5 sm:bottom-2 sm:left-2" />
                  <Screw className="bottom-1.5 right-1.5 sm:bottom-2 sm:right-2" />
                  <h3 className="caps text-[0.66rem] leading-snug tracking-[0.18em] sm:text-[0.74rem] sm:tracking-[0.24em]">{h.title}</h3>
                  <p className="mt-1 font-numeral text-[1.15rem] font-semibold leading-tight sm:text-[1.5rem]">{h.detail}</p>
                  <p className="mt-0.5 font-serif text-[0.88rem] italic sm:text-[0.95rem]">
                    {h.roundId ? (
                      <Link
                        href={`/clubhouse/rounds/${h.roundId}`}
                        className="inline-flex min-h-6 items-center gap-1 underline decoration-1 underline-offset-[3px] after:absolute after:inset-0 after:rounded-lg after:content-[''] is-hover:decoration-2 focus-visible:outline-[#2a1f0a]"
                      >
                        {day(h.date)}<span className="sr-only">: see the card for {h.title}</span>
                      </Link>
                    ) : (
                      day(h.date)
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid justify-items-start gap-4 p-2 sm:justify-items-center sm:p-4 sm:text-center">
              <p className="font-serif text-lede text-on-green">Your first honor comes with your first card.</p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/clubhouse" tone="green" variant="primary">Tee off</ButtonLink>
                <ButtonLink href="/clubhouse/rounds/new" tone="green" variant="secondary">Log a round you’ve played</ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>

      <ActionList className="mt-4" label="Trophies">
        <ActionRow href="/clubhouse/trophies" icon="trophy" title="Trophy Room" detail={`${trophies.wonCount} of ${trophies.total} won · see this week's case`} />
      </ActionList>

      {/* Your account and data */}
      <section aria-labelledby="data-h" className="mt-14">
        <SectionHeading id="data-h" title="Your account and data" lede="Your journal is saved to your account as you play: on every device you sign in on, and private to you. A downloaded copy is yours to keep as well." />
        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="grid content-start gap-8">
            <Group caption="Account" footer="Your cards are stored against this account, and no one else's sign-in can read them.">
              <SettingRow title="Signed in" detail={email ? <span className="[overflow-wrap:anywhere]">{email}</span> : "Your 18 Eagles account"}>
                <Button variant="secondary" size="sm" onClick={() => openUserProfile()}>Manage account</Button>
              </SettingRow>
              <SettingRow title="Sign out" detail="Your journal stays in your account, ready when you sign back in.">
                <Button variant="secondary" size="sm" loading={leaving} loadingLabel="Signing out" onClick={() => { setLeaving(true); void signOut({ redirectUrl: "/clubhouse" }); }}>Sign out</Button>
              </SettingRow>
            </Group>
            <Group caption="Backup">
              <SettingRow title="Keep a copy" detail="Download every card, your bag, and your settings as one file, for your own records.">
                <Button onClick={exportData} variant="secondary" size="sm">Export my data</Button>
              </SettingRow>
              <div className="grid gap-2 p-4 sm:p-5">
                <h3 className="font-semibold text-ink">Bring a copy back</h3>
                <Field id="l-import" label="Import a saved file" hint="Choose a .json file exported from the Locker. It replaces the journal in your account; you can undo right after." error={importError}>
                  {(a) => <TextInput {...a} type="file" accept="application/json,.json" onChange={importData} className="cursor-pointer py-2.5 file:mr-3 file:min-h-8 file:cursor-pointer file:rounded-full file:border-0 file:bg-tint file:px-4 file:font-semibold file:text-green is-hover:file:bg-tint-2" />}
                </Field>
              </div>
            </Group>
          </div>

          <div className="grid content-start gap-8">
            <Group caption="Try it out">
              <SettingRow title="Demo tools" detail="See the app full: 13 rounds over four months at Rancho Santa Fe, Torrey Pines, Pebble Beach, and St Andrews. This replaces your rounds, bag, and settings.">
                <Button variant="secondary" size="sm" onClick={() => setDialog("sample")}>Load a sample season</Button>
              </SettingRow>
            </Group>
            <Group caption="Start fresh">
              <SettingRow title="Erase my journal" detail="Deletes every card, your index, goal, bag, honors, and any courses you added from your account, on every device, and starts fresh. Your sign-in stays; to close the account itself, use Manage account.">
                <Button variant="danger" size="sm" onClick={() => setDialog("erase")}>Erase my journal</Button>
              </SettingRow>
            </Group>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={dialog === "sample"}
        title="Replace your data with a sample season?"
        body={<p>Your {store.rounds.length === 1 ? "1 card" : `${store.rounds.length} cards`}, bag, and settings are replaced in your account by 13 sample rounds. Courses you added are kept. Export a copy first if you want to come back to your own.</p>}
        confirmLabel="Load the sample"
        cancelLabel="Keep my data"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          const sample = withSampleSeason(store);
          update(() => sample);
          setDialog(null);
          setIndexText(null);
          toast({ message: `Loaded a sample season: ${sample.rounds.length} rounds` });
        }}
      />
      <ConfirmDialog
        open={dialog === "erase"}
        danger
        title="Erase your journal?"
        body={<p>Every card, your index and goal, your bag, honors, and added courses are deleted from your account, on every device. This can’t be undone. Your sign-in itself stays.</p>}
        confirmLabel="Erase my journal"
        cancelLabel="Keep my data"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          resetAll();
          try {
            Object.keys(window.localStorage).filter((k) => k.startsWith("18eagles:draft:")).forEach((k) => window.localStorage.removeItem(k));
          } catch {}
          setDialog(null);
          router.push("/clubhouse");
        }}
      />
    </Page>
  );
}

/** An iOS Settings group: a small caption above, one rounded card with rows split by hairlines, an optional note below. */
/** The golfer's name, shown in the Clubhouse greeting and on the locker plate. */
function NameForm({ name, onSaved }: { name: string | null; onSaved: (n: string) => void }) {
  const [v, setV] = useState(name ?? "");
  const [error, setError] = useState<string | undefined>();
  const ref = useRef<HTMLInputElement>(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = v.trim().replace(/\s+/g, " ");
    const err = !n ? "Type your name, or a nickname." : n.length > 30 ? `Keep it to 30 characters (that's ${n.length}).` : undefined;
    if (err) { setError(err); focusInvalid(ref.current); return; }
    patchProfile({ name: n });
    onSaved(n);
    // A new name remounts this form (it's keyed by the name); put focus back on its button.
    requestAnimationFrame(() => visibleById("l-name-save")?.focus());
  };
  return (
    <form noValidate onSubmit={save} className="grid gap-3 p-4 sm:p-5">
      <Field label="Your name" hint="Shown on your locker and in the Clubhouse greeting." error={error}>
        {(a) => <TextInput ref={ref} {...a} value={v} maxLength={40} autoComplete="given-name" autoCapitalize="words" enterKeyHint="done" onChange={(e) => { setV(e.target.value); if (error) setError(undefined); }} />}
      </Field>
      <div><Button id="l-name-save" type="submit" variant="primary">Save name</Button></div>
    </form>
  );
}

function Group({ caption, footer, className, children }: { caption?: ReactNode; footer?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      {caption && <p className="caps mb-2 px-4 text-label text-ink-2 sm:px-5">{caption}</p>}
      <div className="divide-y divide-rule/80 overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card">{children}</div>
      {footer && <p className="mt-2 px-4 text-[0.9rem] leading-snug text-ink-2 sm:px-5">{footer}</p>}
    </div>
  );
}

/** One settings row: a title and a line of detail, with its button on the right (below it on a phone). */
function SettingRow({ title, detail, children }: { title: string; detail: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:p-5">
      <div className="min-w-0">
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[0.95rem] leading-snug text-ink-2">{detail}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Screw({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute size-2.5 rounded-full ${className}`}
      style={{ background: "radial-gradient(circle at 35% 35%, #f1dfb2, #8a6a2c 70%)", boxShadow: "inset 0 0 0 .5px rgb(0 0 0 / .4)" }}
    >
      <span className="absolute left-1/2 top-[15%] h-[70%] w-px -translate-x-1/2 rotate-45 bg-[#5a4317]" />
    </span>
  );
}
