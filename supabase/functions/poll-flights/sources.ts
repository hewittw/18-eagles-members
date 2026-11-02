// Where the aircraft come from, in order. adsb.lol first; if it answers 429 (it rate-limits Supabase's shared Edge
// egress) or fails in any way, adsb.fi for the same airport. Both serve readsb JSON with the same field names; only
// the list's name differs (`ac` vs `aircraft`), which parseFlights accepts either way.
// Pure: no Deno or npm imports. The fetcher, clock and sleep are passed in, so the Node tests drive it with fakes.

export type SourceId = "lol" | "fi";

export type Source = {
  id: SourceId;
  url: (lat: number, lon: number) => string;
  /** Minimum gap between two calls to this source within a run (adsb.fi asks for at most 1 request a second). */
  minGapMs: number;
};

export const RADIUS_NM = 15;

export const SOURCES: readonly Source[] = [
  { id: "lol", url: (lat, lon) => `https://api.adsb.lol/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${RADIUS_NM}`, minGapMs: 0 },
  { id: "fi", url: (lat, lon) => `https://opendata.adsb.fi/api/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${RADIUS_NM}`, minGapMs: 1100 },
];

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

/**
 * Keeps calls to one source at least `gapMs` apart, even when two airports fall back at the same moment: callers
 * queue behind one another. One Spacer per source per run.
 */
export class Spacer {
  private last = -Infinity;
  private chain: Promise<void> = Promise.resolve();
  private readonly gapMs: number;
  private readonly clock: Clock;
  constructor(gapMs: number, clock: Clock) {
    this.gapMs = gapMs;
    this.clock = clock;
  }
  wait(): Promise<void> {
    const turn = this.chain.then(async () => {
      const due = this.last + this.gapMs - this.clock.now();
      if (due > 0) await this.clock.sleep(due);
      this.last = this.clock.now();
    });
    this.chain = turn.catch(() => {});
    return turn;
  }
}

export type Fetched = { ok: true; source: SourceId; json: unknown; tried: string[] } | { ok: false; tried: string[] };

/**
 * fetchFirst(at, fetcher, spacers, sources?) → the first source that answers, in order, or every reason they didn't.
 * Any error from a source (HTTP 429 or 5xx, timeout, network, bad JSON) moves on to the next one. `describe` turns an
 * error into a short reason for the run detail ("429", "timed out").
 */
export async function fetchFirst(
  at: { lat: number; lon: number },
  fetcher: (url: string) => Promise<unknown>,
  spacers: ReadonlyMap<SourceId, Spacer>,
  describe: (e: unknown) => string,
  sources: readonly Source[] = SOURCES,
): Promise<Fetched> {
  const tried: string[] = [];
  for (const s of sources) {
    await spacers.get(s.id)?.wait();
    try {
      const json = await fetcher(s.url(at.lat, at.lon));
      return { ok: true, source: s.id, json, tried };
    } catch (e) {
      tried.push(`${s.id} ${describe(e)}`);
    }
  }
  return { ok: false, tried };
}

/** One spacer per source with a gap, sharing the run's clock. */
export function spacersFor(clock: Clock, sources: readonly Source[] = SOURCES): Map<SourceId, Spacer> {
  return new Map(sources.filter((s) => s.minGapMs > 0).map((s) => [s.id, new Spacer(s.minGapMs, clock)]));
}
