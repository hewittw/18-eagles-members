"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowIcon, Button, ButtonLink, Callout, Card, ChoiceGroup, ConfirmDialog, DateInput, Field, NumberInput, SectionHeading, Select,
  Stepper, Tag, TextArea, TextInput, Toast, ToggleChip, useToast, VisuallyHidden,
} from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { COURSES } from "./sample-data";
import { Demo, Spec, State, States } from "./ds";

const noop = () => {};
const FlagIcon = () => (
  <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true"><path d="M4 15 V1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 1.8 L13 4.5 L4.5 7.2 Z" fill="currentColor" /></svg>
);

/* ─────────────── Button ─────────────── */
export function ButtonSpec() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    window.setTimeout(() => { setSaving(false); toast({ message: "Round saved to your journal." }); }, 1400);
  };
  const variants = ["primary", "secondary", "quiet", "danger"] as const;
  return (
    <Spec
      id="button"
      name="Button"
      from="ui"
      summary={<>A real <code>&lt;button&gt;</code> with a condensed-caps label. Presses sink 1px and fill. The ring sits 2px off the button on the surface around it, because a brass or ink ring on the fill would fail.</>}
      use={[
        "One primary (Fairway) per screen: the thing the golfer came to do.",
        "Secondary for the other real actions; quiet for low-stakes ones (Show as table, Skip).",
        "Danger only for removal. Prefer doing it and offering Undo.",
        <>On Locker Green, pass <code>tone=&quot;green&quot;</code>: the primary turns paper.</>,
        <><code>loading</code> keeps the label so the width holds, sets <code>aria-busy</code>, and reads &ldquo;Working&rdquo;.</>,
      ]}
    >
      {variants.map((v) => (
        <States key={v} label={`${v}`} cols="auto">
          <State label="Rest"><Button variant={v}>Start round</Button></State>
          <State label="Hover" force="hover"><Button variant={v}>Start round</Button></State>
          <State label="Focus-visible" force="focus"><Button variant={v}>Start round</Button></State>
          <State label="Pressed" force="pressed"><Button variant={v}>Start round</Button></State>
          <State label="Disabled"><Button variant={v} disabled>Start round</Button></State>
          <State label="Loading"><Button variant={v} loading>Saving</Button></State>
        </States>
      ))}
      <States label="On Locker Green" tone="green">
        {(["primary", "secondary", "quiet"] as const).map((v) => (
          <State key={v} tone="green" label={v}><Button tone="green" variant={v}>Play again</Button></State>
        ))}
        <State tone="green" label="Focus (brass ring)" force="focus"><Button tone="green" variant="primary">Play again</Button></State>
        <State tone="green" label="Disabled"><Button tone="green" variant="primary" disabled>Play again</Button></State>
      </States>
      <States label="Sizes and icon" cols="wide">
        <State label="sm · 44px"><Button size="sm">Undo</Button></State>
        <State label="md · 48px"><Button>Add a note</Button></State>
        <State label="lg · 56px"><Button size="lg" variant="primary" icon={<FlagIcon />}>Tee off</Button></State>
      </States>
      <Demo>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" loading={saving} loadingLabel="Saving the round" onClick={save}>Save the round</Button>
          <Button onClick={() => toast({ message: "Note added to hole 7." })}>Add a note</Button>
          <Button variant="quiet" onClick={() => toast({ message: "Skipped. You can set a goal later in the Locker." })}>Skip for now</Button>
        </div>
        <p className="mt-3 text-[0.92rem] text-ink-2">Save shows the loading state for a moment, then a toast confirms.</p>
      </Demo>
    </Spec>
  );
}

export function ButtonLinkSpec() {
  return (
    <Spec
      id="buttonlink"
      name="ButtonLink"
      from="ui"
      summary={<>Navigation that looks like a button: a Next <code>&lt;Link&gt;</code> with Button&apos;s classes, so it&apos;s announced as a link and opens in a new tab like one.</>}
      use={["Use it when the action goes somewhere (Start a round → the course list).", "Use Button when it does something in place (Save, Undo)."]}
    >
      <States label="States">
        <State label="Rest"><ButtonLink href="/clubhouse/courses" variant="primary" icon={<ArrowIcon />}>Choose a course</ButtonLink></State>
        <State label="Hover" force="hover"><ButtonLink href="/clubhouse/courses" variant="primary">Choose a course</ButtonLink></State>
        <State label="Focus-visible" force="focus"><ButtonLink href="/clubhouse/courses" variant="secondary">All cards</ButtonLink></State>
        <State label="Pressed" force="pressed"><ButtonLink href="/clubhouse/courses" variant="secondary">All cards</ButtonLink></State>
      </States>
      <Demo>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/clubhouse/courses" variant="primary" size="lg">Start a round <span aria-hidden="true">→</span></ButtonLink>
          <ButtonLink href="/mood-board">Back to the mood board</ButtonLink>
        </div>
      </Demo>
    </Spec>
  );
}

/* ─────────────── Field + inputs ─────────────── */
export function FieldSpec() {
  const toast = useToast();
  const [v, setV] = useState({ name: "", par: "", date: "", tee: "", note: "" });
  const [errs, setErrs] = useState<Partial<Record<keyof typeof v, string>>>({});
  const refs = { name: useRef<HTMLInputElement>(null), par: useRef<HTMLInputElement>(null), tee: useRef<HTMLSelectElement>(null) };
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const out: typeof errs = {};
    if (!v.name.trim()) out.name = "Enter the course name, as it appears on the card.";
    const par = Number(v.par);
    if (!v.par.trim()) out.par = "Enter the course par, for example 72.";
    else if (!Number.isInteger(par) || par < 27 || par > 80) out.par = "Enter par as a whole number from 27 to 80.";
    if (!v.tee) out.tee = "Choose the tees you play.";
    setErrs(out);
    const first = (["name", "par", "tee"] as const).find((k) => out[k]);
    if (first) refs[first].current?.focus();
    else toast({ message: `${v.name.trim()} added to your courses.` });
  };
  return (
    <Spec
      id="field"
      name="Field"
      from="ui"
      summary={<>One labelled field: <code>&lt;label for&gt;</code>, an optional hint, the control (a render prop that receives <code>id</code>, <code>aria-describedby</code>, <code>aria-invalid</code>), and the error beside it with an icon.</>}
      use={[
        "Stack fields in one column. Label above, never a placeholder in place of a label.",
        <>Mark the optional ones with <code>optional</code>; required is the default and needs no asterisk.</>,
        "Write errors as the next step: \"Enter par as a whole number from 27 to 80.\"",
        "On submit, move focus to the first invalid field. Keep everything typed.",
        <>Inputs: <code>TextInput</code>, <code>NumberInput</code> (number pad, never rounds), <code>DateInput</code>, <code>Select</code>, <code>TextArea</code> (<code>voice</code> for notes).</>,
      ]}
    >
      <States label="States" cols="wide">
        <State label="Rest"><div className="w-full"><Field label="Course name">{(a) => <TextInput {...a} />}</Field></div></State>
        <State label="Hover" force="hover"><div className="w-full"><Field label="Course name">{(a) => <TextInput {...a} />}</Field></div></State>
        <State label="Focus-visible" force="focus"><div className="w-full"><Field label="Course name">{(a) => <TextInput {...a} defaultValue="Torrey Pi" />}</Field></div></State>
        <State label="Filled, with hint"><div className="w-full"><Field label="Handicap index" hint="From your GHIN app, if you have one" optional>{(a) => <NumberInput decimal {...a} defaultValue="14.2" />}</Field></div></State>
        <State label="Error"><div className="w-full"><Field label="Par" error="Enter par as a whole number from 27 to 80.">{(a) => <NumberInput {...a} defaultValue="7" />}</Field></div></State>
        <State label="Disabled"><div className="w-full"><Field label="Course rating" hint="Set by the course">{(a) => <NumberInput decimal {...a} defaultValue="74.6" disabled />}</Field></div></State>
        <State label="Select"><div className="w-full"><Field label="Tees">{(a) => <Select {...a} defaultValue="Blue"><option>Blue</option></Select>}</Field></div></State>
        <State label="Date"><div className="w-full"><Field label="Played on">{(a) => <DateInput {...a} defaultValue="2026-10-12" />}</Field></div></State>
        <State label="TextArea voice"><div className="w-full"><Field label="Round note" optional>{(a) => <TextArea voice rows={2} {...a} defaultValue="Lag putting was the difference." />}</Field></div></State>
      </States>
      <Demo title="Try it: add a course (submit it empty)">
        <form noValidate onSubmit={submit} className="grid max-w-[34rem] gap-5">
          <Field label="Course name" error={errs.name}>{(a) => <TextInput ref={refs.name} {...a} value={v.name} onChange={set("name")} autoComplete="off" />}</Field>
          <Field label="Par" hint="For all 18 holes" error={errs.par}>{(a) => <NumberInput ref={refs.par} {...a} value={v.par} onChange={set("par")} />}</Field>
          <Field label="Tees you play" error={errs.tee}>
            {(a) => (
              <Select ref={refs.tee} {...a} value={v.tee} onChange={set("tee")}>
                <option value="">Choose…</option><option>Black</option><option>Blue</option><option>White</option><option>Gold</option>
              </Select>
            )}
          </Field>
          <Field label="First played" optional>{(a) => <DateInput {...a} value={v.date} onChange={set("date")} />}</Field>
          <Field label="Note" optional hint="Your words, kept with the course">{(a) => <TextArea voice {...a} value={v.note} onChange={set("note")} placeholder="Greens run fast after noon." />}</Field>
          <div className="flex flex-wrap gap-3"><Button type="submit" variant="primary">Add the course</Button><Button variant="quiet" onClick={() => { setErrs({}); }}>Clear errors</Button></div>
        </form>
      </Demo>
    </Spec>
  );
}

/* ─────────────── ChoiceGroup ─────────────── */
export function ChoiceSpec() {
  const [tee, setTee] = useState<string | null>("Blue");
  const [holes, setHoles] = useState<string | null>("18");
  const [goal, setGoal] = useState<string | null>(null);
  const tees = PINE.tees.map((t) => ({ value: t.name, label: t.name, hint: `${t.yards.toLocaleString("en-US")} yds · ${t.rating}/${t.slope}` }));
  return (
    <Spec
      id="choicegroup"
      name="ChoiceGroup"
      from="ui"
      summary={<>One choice from a few: native radios in a <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code>. Tab enters once; arrow keys move and choose. Chosen faces fill Locker Green and the pip fills brass, so it reads without color.</>}
      use={[
        <>Tees, the goal, 9 or 18, filters, fairway. <code>layout</code>: row (equal, 2–3 options), wrap, or grid.</>,
        "Use it when there are two to seven options and all should be visible. More than that: Select.",
        <>Pass <code>error</code> (&ldquo;Choose a tee&rdquo;) and it&apos;s linked to the group.</>,
      ]}
    >
      <States label="States" cols="wide">
        <State label="Rest"><ChoiceGroup hideLegend legend="Holes" value={null} onChange={noop} layout="row" options={[{ value: "18", label: "18 holes" }, { value: "9", label: "Front 9" }]} /></State>
        <State label="Hover" force="hover"><ChoiceGroup hideLegend legend="Holes" value={null} onChange={noop} layout="row" options={[{ value: "18", label: "18 holes" }]} /></State>
        <State label="Focus-visible" force="focus"><ChoiceGroup hideLegend legend="Holes" value="18" onChange={noop} layout="row" options={[{ value: "18", label: "18 holes" }]} /></State>
        <State label="Pressed" force="pressed"><ChoiceGroup hideLegend legend="Holes" value={null} onChange={noop} layout="row" options={[{ value: "9", label: "Front 9" }]} /></State>
        <State label="Selected"><ChoiceGroup hideLegend legend="Holes" value="18" onChange={noop} layout="row" options={[{ value: "18", label: "18 holes" }, { value: "9", label: "Front 9" }]} /></State>
        <State label="Disabled option"><ChoiceGroup hideLegend legend="Holes" value="18" onChange={noop} layout="row" options={[{ value: "18", label: "18 holes" }, { value: "b", label: "Back 9", disabled: true }]} /></State>
        <State label="Error"><ChoiceGroup legend="Tees" error="Choose the tees you're playing." value={null} onChange={noop} layout="row" options={[{ value: "a", label: "Blue" }, { value: "b", label: "White" }]} /></State>
      </States>
      <Demo>
        <div className="grid gap-7">
          <ChoiceGroup legend={`Tees at ${PINE.shortName}`} value={tee} onChange={setTee} layout="grid" size="lg" options={tees} />
          <ChoiceGroup legend="How many holes?" value={holes} onChange={setHoles} layout="row" options={[{ value: "18", label: "All 18" }, { value: "front", label: "Front 9" }, { value: "back", label: "Back 9" }]} />
          <ChoiceGroup legend="What are you working toward?" hint="It sets the line on your trend chart. Change it any time." value={goal} onChange={setGoal} layout="wrap" size="sm" options={[{ value: "100", label: "Break 100" }, { value: "90", label: "Break 90" }, { value: "80", label: "Break 80" }, { value: "scratch", label: "Scratch" }]} />
        </div>
      </Demo>
    </Spec>
  );
}
const PINE = COURSES.find((c) => c.slug === "pinehurst-no-2")!;

/* ─────────────── ToggleChip ─────────────── */
export function ToggleSpec() {
  const tags = ["links", "parkland", "coastal", "major-host"] as const;
  const label: Record<string, string> = { links: "Links", parkland: "Parkland", coastal: "Coastal", "major-host": "Major host" };
  const [on, setOn] = useState<Record<string, boolean>>({ links: true });
  const active = tags.filter((t) => on[t]);
  const shown = COURSES.filter((c) => active.every((t) => c.tags.includes(t)));
  return (
    <Spec
      id="togglechip"
      name="ToggleChip"
      from="ui"
      summary={<>An on/off option: a real button with <code>aria-pressed</code>. Pressed fills Locker Green and swaps the plus for a brass tick.</>}
      use={["Filters that combine (Links + Coastal). For one-of-many, use ChoiceGroup.", "Say what the filter did in a polite live region (\"4 courses\")."]}
    >
      <States label="States" cols="wide">
        <State label="Rest"><ToggleChip pressed={false} onPressedChange={noop}>Links</ToggleChip></State>
        <State label="Hover" force="hover"><ToggleChip pressed={false} onPressedChange={noop}>Links</ToggleChip></State>
        <State label="Focus-visible" force="focus"><ToggleChip pressed={false} onPressedChange={noop}>Links</ToggleChip></State>
        <State label="Pressed (active)" force="pressed"><ToggleChip pressed={false} onPressedChange={noop}>Links</ToggleChip></State>
        <State label="On (aria-pressed)"><ToggleChip pressed onPressedChange={noop}>Links</ToggleChip></State>
        <State label="Disabled"><ToggleChip pressed={false} disabled onPressedChange={noop}>Desert</ToggleChip></State>
      </States>
      <Demo title="Try it: filter the library">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter courses">
          {tags.map((t) => <ToggleChip key={t} pressed={!!on[t]} onPressedChange={(p) => setOn((x) => ({ ...x, [t]: p }))}>{label[t]}</ToggleChip>)}
        </div>
        <p className="caps mt-4 text-[0.75rem] text-ink-2" aria-live="polite">{shown.length} {shown.length === 1 ? "course" : "courses"}</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {shown.map((c) => <li key={c.slug} className="font-serif text-[1.02rem]">{c.name}</li>)}
          {!shown.length && <li className="font-serif italic text-ink-2">No course is all of those. Turn one filter off.</li>}
        </ul>
      </Demo>
    </Spec>
  );
}

/* ─────────────── Stepper ─────────────── */
export function StepperSpec() {
  const [putts, setPutts] = useState<number | null>(2);
  const [pen, setPen] = useState<number | null>(0);
  return (
    <Spec
      id="stepper"
      name="Stepper"
      from="ui"
      summary={<>− value + with real buttons (44px, or 56px at <code>lg</code>), disabled at the limits, and a polite announcement on each change (&ldquo;Putts: 3 putts&rdquo;).</>}
      use={["Small counts on the hole screen: putts, penalties.", <>Empty is allowed (<code>null</code>, shown as a dash): not every golfer counts putts.</>, <>Give it a <code>unit</code> so the announcement is a sentence.</>]}
    >
      <States label="States" cols="wide">
        <State label="Empty"><Stepper label="Putts" value={null} onChange={noop} /></State>
        <State label="Rest"><Stepper label="Putts" value={2} onChange={noop} /></State>
        <State label="At the minimum"><Stepper label="Penalties" value={0} onChange={noop} /></State>
        <State label="Hover (+)" force="hover"><Stepper label="Putts" value={2} max={2} onChange={noop} /></State>
        <State label="Focus-visible" force="focus"><Stepper label="Putts" value={2} max={2} min={2} onChange={noop} /></State>
        <State label="Disabled"><Stepper label="Putts" value={2} disabled onChange={noop} /></State>
      </States>
      <Demo>
        <div className="flex flex-wrap gap-10">
          <Stepper label="Putts" value={putts} onChange={setPutts} max={6} size="lg" unit={{ one: "putt", many: "putts" }} start={2} />
          <Stepper label="Penalties" value={pen} onChange={setPen} max={4} size="lg" unit={{ one: "penalty stroke", many: "penalty strokes" }} hint="Out of bounds, water, unplayable" />
        </div>
      </Demo>
    </Spec>
  );
}

/* ─────────────── Surfaces ─────────────── */
export function SurfaceSpecs() {
  return (
    <>
      <Spec
        id="card"
        name="Card"
        from="ui"
        summary="A surface: Tile White on a hairline, woven linen for asides, or Locker Green with a faint grain. Square corners, no soft shadow."
        use={[<>Use <code>as</code> for semantics: <code>article</code> for a round, <code>li</code> in lists, <code>section</code> with a heading.</>, <><code>tone=&quot;green&quot;</code> turns focus rings brass inside it automatically.</>, "Don't nest cards. Use rules and space to group inside one."]}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="caps text-label text-gold-ink">tone paper</p><p className="mt-2 font-display text-title">Last time here</p><p className="mt-1 text-ink-2">84 from the Blue tees, 12 Oct.</p></Card>
          <Card texture="linen"><p className="caps text-label text-gold-ink">texture linen</p><p className="mt-2 font-display text-title">The Locker</p><p className="mt-1 text-ink-2">14 clubs in the bag.</p></Card>
          <Card tone="green"><p className="caps text-label text-gold">tone green</p><p className="mt-2 font-display text-title text-on-green">Low round</p><p className="mt-1 text-paper-3">79 at the Old Course.</p></Card>
        </div>
      </Spec>
      <Spec
        id="sectionheading"
        name="SectionHeading"
        from="ui"
        summary="A section title closed by the scorecard's double rule: brass eyebrow, Caslon title, optional numeral, lede, and an action at the right."
        use={["Level 2 under the page's h1; level 3 inside a section. Keep the order.", "The action is a quiet link or button (\"All cards\"), never a second primary."]}
      >
        <div inert className="grid gap-10 border border-rule bg-paper p-5 sm:p-8">
        <SectionHeading eyebrow="Since your last visit" title="Three rounds, one personal best" numeral="II" lede="Your index moved from 14.2 to 13.6." action={<ButtonLink href="/clubhouse/rounds" variant="quiet">All cards</ButtonLink>} />
        <SectionHeading level={3} eyebrow="Par 3s" title="Most to gain on the short holes" />
        </div>
      </Spec>
      <Spec id="tag" name="Tag" from="ui" summary="A condensed-caps label in words. Neutral for facts, green for yours, gold (with a star) for honors." use={["Course tags, round status (In progress), honors (Personal best).", "Not a button. If it does something, it's a ToggleChip."]}>
        <div className="flex flex-wrap gap-2"><Tag>Links</Tag><Tag>Major host</Tag><Tag>9 holes</Tag><Tag tone="green">Home course</Tag><Tag tone="green">In progress</Tag><Tag tone="gold">Personal best</Tag><Tag tone="gold">First eagle</Tag></div>
      </Spec>
      <Spec id="callout" name="Callout" from="ui" summary="Gentle guidance in the margin: slate for information, linen and Old Brass for something earned. Not an empty state, not an alarm." use={["One per screen at most.", "Tell the golfer where they stand and what's next (\"Two more cards and the index appears\")."]}>
        <Callout title="1 of 3 rounds to your index">Post two more cards and 18 Eagles works out your handicap index from them. Until then it shows the one you typed.</Callout>
        <Callout tone="gold" title="A new low round" action={<ButtonLink href="/clubhouse/locker" size="sm">See it in the Locker</ButtonLink>}>79 at the Old Course on 5 October. A brass plate is waiting for it.</Callout>
      </Spec>
    </>
  );
}

/* ─────────────── Toast + ConfirmDialog ─────────────── */
export function FeedbackSpecs() {
  const toast = useToast();
  const [rounds, setRounds] = useState(["Old Course · 80 · 5 Oct", "Rancho Santa Fe · 81 · 12 Oct", "Torrey Pines South · 84 · 24 Sep"]);
  const [open, setOpen] = useState(false);
  const [erased, setErased] = useState(false);
  const remove = (i: number) => {
    const gone = rounds[i];
    setRounds((r) => r.filter((_, j) => j !== i));
    toast({ message: `Deleted the round: ${gone}.`, action: { label: "Undo", onClick: () => setRounds((r) => { const n = [...r]; n.splice(i, 0, gone); return n; }) } });
  };
  return (
    <>
      <Spec
        id="toast"
        name="Toast"
        from="ui"
        summary={<>A slip of Locker Green at the foot of the screen, in one polite live region. With an action it stays at least 8 seconds, and pauses while hovered or focused. <code>{"const toast = useToast(); toast({ message, action })"}</code>, under a <code>&lt;ToastProvider&gt;</code>.</>}
        use={["Undo over confirm: do the thing, then offer to take it back.", "Say what happened in plain words, with the name of the thing.", "One at a time; a newer message replaces the last."]}
      >
        <States label="States" cols="2">
          <State label="Message"><Toast message="Round saved to your journal." onDismiss={noop} /></State>
          <State label="With Undo"><Toast message="Deleted the round at Rancho Santa Fe." action={{ label: "Undo", onClick: noop }} onDismiss={noop} /></State>
          <State label="Undo focused" force="focus"><Toast message="Removed the 3-iron from your bag." action={{ label: "Undo", onClick: noop }} /></State>
          <State label="Undo hovered" force="hover"><Toast message="Cleared 4 shots." action={{ label: "Undo", onClick: noop }} /></State>
        </States>
        <Demo title="Try it: delete a round, then undo">
          <ul className="grid gap-1.5">
            {rounds.map((r, i) => (
              <li key={r} className="flex items-center justify-between gap-3 border-b border-rule pb-1.5">
                <span className="min-w-0 font-serif">{r}</span>
                <Button size="sm" variant="danger" onClick={() => remove(i)}>Delete<VisuallyHidden> {r}</VisuallyHidden></Button>
              </li>
            ))}
            {!rounds.length && <li className="font-serif italic text-ink-2">No cards left. Undo brings the last one back.</li>}
          </ul>
        </Demo>
      </Spec>
      <Spec
        id="confirmdialog"
        name="ConfirmDialog"
        from="ui"
        summary={<>A native <code>&lt;dialog&gt;</code> opened as a modal: the page behind goes inert, focus starts on Cancel, Esc cancels, and focus returns to the button that opened it.</>}
        use={["Only for what can't be undone: \"Erase my journal\".", "Name the consequence in the title, and the thing in the confirm button."]}
      >
        <States label="At rest (as drawn when open)" cols="2">
          <State label="danger">
            <div className="w-full border border-ink bg-paper p-5 shadow-lift">
              <p className="caps text-label text-gold-ink">Can&apos;t be undone</p>
              <p className="mt-1 font-display text-title">Erase everything?</p>
              <div className="rule-double mt-3 text-ink" />
              <p className="mt-3 text-ink-2">13 rounds, your bag, and your courses leave your account.</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2"><Button size="sm">Keep my rounds</Button><Button size="sm" variant="danger">Erase everything</Button></div>
            </div>
          </State>
        </States>
        <Demo>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="danger" onClick={() => setOpen(true)}>Erase everything…</Button>
            <p className="text-[0.95rem] text-ink-2" aria-live="polite">{erased ? "Erased (pretend). Nothing on this page was stored." : "Nothing is erased in this demo."}</p>
          </div>
          <ConfirmDialog
            open={open}
            danger
            title="Erase your journal?"
            body="Your 13 rounds, your bag, and the courses you added will be deleted from your account on every device. Export them from the Locker first if you want a copy."
            confirmLabel="Erase everything"
            cancelLabel="Keep my rounds"
            onConfirm={() => { setOpen(false); setErased(true); }}
            onCancel={() => setOpen(false)}
          />
        </Demo>
      </Spec>
      <Spec
        id="skiplink"
        name="SkipLink"
        from="ui"
        summary={<>The first Tab stop on every page: &ldquo;Skip to main content&rdquo;, jumping to <code>&lt;main id=&quot;main&quot;&gt;</code>. Hidden until focused. <code>VisuallyHidden</code> is its sibling: text for screen readers only.</>}
        use={["AppShell includes it; process pages add their own (this one does: press Tab at the top).", <>Use <code>VisuallyHidden</code> for words a sighted reader gets from shape or position (&ldquo;Birdie, 3&rdquo;, &ldquo;current hole&rdquo;).</>]}
      >
        <States label="Focused" cols="2">
          <State label="SkipLink, focused"><span className="caps bg-green-3 px-4 py-3 text-[0.85rem] text-on-green shadow-lift outline-2 outline-offset-2 outline-gold">Skip to main content</span></State>
          <State label="VisuallyHidden"><code className="text-[0.9rem] [overflow-wrap:anywhere]">{"<VisuallyHidden>Birdie, 3</VisuallyHidden>"}</code></State>
        </States>
      </Spec>
    </>
  );
}

/* ─────────────── Motion ─────────────── */
export function MotionDemo() {
  const [k, setK] = useState(0);
  const run = [0, -1, -1, 0, -2, -2, -1, -1, 0];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0">
        <h3 className="font-display text-title">Motion</h3>
        <ul className="mt-3 grid gap-2 text-[0.98rem] text-ink-2">
          <li><strong className="font-medium text-ink">Hang</strong>, the signature: tiles drop 6px and fade in over <code className="font-numeral">420ms</code> <code className="font-numeral">ease-hang</code>, staggered 28ms, as if hung by hand. First render of a board, or when a score lands.</li>
          <li><strong className="font-medium text-ink">Press</strong>: 1px down and fill, <code className="font-numeral">150ms ease-press</code>.</li>
          <li><strong className="font-medium text-ink">Fade</strong>: numbers cross-fade in <code className="font-numeral">300ms</code>; no counting up.</li>
          <li><strong className="font-medium text-ink">Reduced motion</strong>: <code className="font-numeral">prefers-reduced-motion: reduce</code> turns every animation and transition off.</li>
        </ul>
        <Button className="mt-5" onClick={() => setK((x) => x + 1)}>Hang the tiles again</Button>
      </div>
      <div className="tex-locker on-green min-w-0 p-3 sm:p-5">
        <div className="border-[5px] border-paper-2 bg-paper-2 p-1.5">
          <p className="caps border-b-2 border-ink pb-2 text-center text-[1.1rem] tracking-[0.28em] text-ink">Thru nine</p>
          <ol key={k} className="mt-1.5 grid grid-cols-9 gap-[3px]" aria-label="Score to par after each hole">
            {run.map((v, i) => (
              <li key={i} className="tile hang grid aspect-[3/4] place-items-center font-numeral text-[clamp(1rem,3.4vw,1.9rem)] font-bold text-ink" style={{ ["--i" as string]: i }}>
                <span aria-hidden="true" className={cx(v < 0 && "text-under")}>{v === 0 ? "E" : v < 0 ? `−${-v}` : `+${v}`}</span>
                <span className="sr-only">Hole {i + 1}: {v === 0 ? "even" : v < 0 ? `${-v} under` : `${v} over`}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
