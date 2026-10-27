"use client";
// "Find your course": search OpenGolfAPI (through our /api/golf/search route), pick a result, and the add-a-course
// form fills itself. Its own little form (forms can't nest), above the main one. What's typed is kept as a draft.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiCredit, ApiState, CourseHits } from "@/components/golf";
import { Button, Field, TextInput, focusInvalid } from "@/components/ui";
import { loadCourse, loadSearch } from "@/lib/api/client";
import type { CourseDetail, CourseHit } from "@/lib/api/types";
import { useDraft } from "@/lib/hooks";
import { validateFind } from "@/lib/validate";

type Search = { state: "idle" } | { state: "loading"; q: string; st: string } | { state: "ok"; q: string; st: string; hits: CourseHit[] } | { state: "empty"; q: string; st: string } | { state: "down"; q: string; st: string };

export function CourseFinder({ onFill, onManual, pickedId, initialQuery }: {
  onFill: (d: CourseDetail) => void;
  /** "Enter it yourself": focus the form's name field (with what was searched, if the name is still blank). */
  onManual: (q: string) => void;
  pickedId: string | null;
  /** From "Add “Balboa Park” as a course": search for it straight away. */
  initialQuery?: string;
}) {
  const [f, setF] = useDraft("course-find", { q: "", st: "" });
  const [errors, setErrors] = useState<{ q?: string; state?: string }>({});
  const [search, setSearch] = useState<Search>({ state: "idle" });
  const [picking, setPicking] = useState<string | null>(null);
  const [pickDown, setPickDown] = useState<string | null>(null);
  const qRef = useRef<HTMLInputElement>(null);
  const stRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const run = async (q: string, st: string) => {
    const e = validateFind(q, st);
    setErrors(e);
    if (e.q || e.state) {
      focusInvalid(e.q ? qRef.current : stRef.current);
      return;
    }
    const n = ++seq.current;
    setPickDown(null);
    setSearch({ state: "loading", q: q.trim(), st: st.trim().toUpperCase() });
    const r = await loadSearch(q, st);
    if (n !== seq.current) return; // a newer search has started
    const base = { q: q.trim(), st: st.trim().toUpperCase() };
    setSearch(r.state === "ok" ? { state: "ok", hits: r.data, ...base } : { state: r.state === "empty" ? "empty" : "down", ...base });
  };

  // Arriving with a name from the course list's search: look it up once.
  const started = useRef(false);
  useEffect(() => {
    if (!initialQuery || started.current) return;
    started.current = true;
    setF({ q: initialQuery, st: "" });
    void run(initialQuery, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(f.q, f.st);
  };

  const pick = async (h: CourseHit) => {
    setPicking(h.id);
    setPickDown(null);
    const r = await loadCourse(h.id);
    setPicking(null);
    if (r.state === "ok") onFill(r.data);
    else setPickDown(h.name);
  };

  const s = search;
  return (
    <section aria-labelledby="find-h" className="grid max-w-xl gap-5 rounded-xl border border-green/25 bg-tint p-5 sm:p-6">
      <div>
        <p className="caps text-label text-gold-ink">The quick way</p>
        <h2 id="find-h" className="mt-1 font-display text-title text-ink">Find your course</h2>
        <p className="mt-1 text-[0.98rem] text-ink-2">Search about 16,800 courses. Pick yours and the form below fills itself: par, stroke index, and every tee&apos;s rating and slope.</p>
      </div>

      <form role="search" aria-label="Find your course in OpenGolfAPI" noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:items-start">
        <Field id="find-q" label="Course name" hint="Part of the name is enough, like “Torrey” or “Balboa”." error={errors.q}>
          {(a) => <TextInput ref={qRef} {...a} type="search" value={f.q} onChange={(e) => { setF((p) => ({ ...p, q: e.target.value })); if (errors.q) setErrors((x) => ({ ...x, q: undefined })); }} autoComplete="off" enterKeyHint="search" />}
        </Field>
        <Field id="find-st" label="State" optional hint="Like CA." error={errors.state}>
          {(a) => <TextInput ref={stRef} {...a} value={f.st} maxLength={2} onChange={(e) => { setF((p) => ({ ...p, st: e.target.value.toUpperCase() })); if (errors.state) setErrors((x) => ({ ...x, state: undefined })); }} autoComplete="address-level1" autoCapitalize="characters" className="uppercase" />}
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={s.state === "loading"} loadingLabel="Searching">Search courses</Button>
        </div>
      </form>

      {/* Results, nothing found, or resting: announced politely, and the area keeps its height while it loads. */}
      <div aria-live="polite" className="grid gap-3 empty:hidden">
        {s.state === "loading" && <ApiState kind="loading" shape="list" label={`Searching for “${s.q}”`} />}
        {s.state === "ok" && (
          <>
            <p className="text-[0.95rem] text-ink">
              {s.hits.length === 1 ? "One course" : `${s.hits.length} courses`} found for “{s.q}”{s.st ? ` in ${s.st}` : ""}. Choose yours.
            </p>
            <CourseHits hits={s.hits} onPick={pick} pickingId={picking} pickedId={pickedId} />
            {pickDown && (
              <ApiState kind="down" title={`${pickDown}'s card didn't open`}>
                OpenGolfAPI didn&apos;t answer. Try that course again in a moment, or fill in the form below yourself.
              </ApiState>
            )}
            <p className="text-[0.92rem] text-ink-2">
              Not one of these?{" "}
              <button type="button" className="link inline-flex min-h-tap items-center font-medium" onClick={() => onManual(s.q)}>Enter it yourself</button>
            </p>
          </>
        )}
        {s.state === "empty" && (
          <ApiState
            kind="empty"
            title={`No course called “${s.q}”${s.st ? ` in ${s.st}` : ""} in OpenGolfAPI`}
            action={
              <>
                {s.st && <Button size="sm" variant="secondary" onClick={() => { setF((p) => ({ ...p, st: "" })); void run(s.q, ""); }}>Search every state</Button>}
                <Button size="sm" variant="secondary" onClick={() => onManual(s.q)}>Enter it yourself</Button>
              </>
            }
          >
            Check the spelling, try a shorter part of the name{s.st ? ", or try without the state" : ""}. Or enter it yourself below: only the name is needed.
          </ApiState>
        )}
        {s.state === "down" && (
          <ApiState
            kind="down"
            title="Course search is resting right now"
            action={
              <>
                <Button size="sm" variant="secondary" onClick={() => void run(s.q, s.st)}>Try the search again</Button>
                <Button size="sm" variant="quiet" onClick={() => onManual(s.q)}>Enter it yourself</Button>
              </>
            }
          >
            OpenGolfAPI isn&apos;t answering. You can still enter the course yourself: only the name is needed, and par starts as a standard layout.
          </ApiState>
        )}
      </div>

      <ApiCredit source="opengolf" />
    </section>
  );
}
