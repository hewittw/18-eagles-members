// Compare what's saved with what the source just sent, so the worker writes only real changes (each write is a
// Realtime message to every open page). Pure and generic: no Deno or npm imports, so the Node tests import it.

export type DiffOptions = {
  /** Delete saved rows the source no longer sends (planes that left, players who dropped off). Default true. */
  deleteMissing?: boolean;
};

export type Diff<T, K extends keyof T> = {
  /** Incoming rows that are new or differ in any compared field: upsert these, as sent. */
  upserts: T[];
  /** Key columns of saved rows missing from the incoming set (always [] with deleteMissing: false). */
  deletes: Pick<T, K>[];
};

/**
 * diffRows(existing, incoming, key, fields, options?) → { upserts, deletes }
 *
 * - `key`: the column (or columns, for a composite key) that identifies a row, e.g. "player_key" or ["airport", "hex"].
 * - `fields`: the columns compared. Leave out columns the database fills in (updated_at), or every row would differ.
 * - Values compare loosely on purpose, so a database round-trip isn't mistaken for a change: null equals undefined,
 *   7 equals "7", two ISO timestamps for the same instant are equal ("…T10:00:00Z" vs "…T10:00:00+00:00"),
 *   and objects/arrays compare by JSON.
 * - Incoming rows with the same key: the last one wins (a single upsert can't touch a row twice).
 */
export function diffRows<T extends Record<string, unknown>, K extends keyof T>(
  existing: readonly Partial<T>[],
  incoming: readonly T[],
  key: K | readonly K[],
  fields: readonly (keyof T)[],
  options: DiffOptions = {},
): Diff<T, K> {
  const keys: readonly K[] = Array.isArray(key) ? (key as readonly K[]) : [key as K];
  const id = (row: Partial<T>) => JSON.stringify(keys.map((k) => norm(row[k])));

  const saved = new Map<string, Partial<T>>();
  for (const row of existing) saved.set(id(row), row);

  const next = new Map<string, T>();
  for (const row of incoming) next.set(id(row), row);

  const upserts: T[] = [];
  for (const [k, row] of next) {
    const old = saved.get(k);
    if (!old || fields.some((f) => !sameValue(old[f], row[f]))) upserts.push(row);
  }

  const deletes: Pick<T, K>[] = [];
  if (options.deleteMissing !== false) {
    for (const [k, row] of saved) {
      if (next.has(k)) continue;
      const pick = {} as Pick<T, K>;
      for (const c of keys) pick[c] = row[c] as T[K];
      deletes.push(pick);
    }
  }
  return { upserts, deletes };
}

const ISO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/** Loose equality for one column (see diffRows). Exported for the tests. */
export function sameValue(a: unknown, b: unknown): boolean {
  return norm(a) === norm(b);
}

function norm(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? `n:${v}` : "null";
  if (typeof v === "string") {
    if (ISO.test(v)) {
      const t = Date.parse(v.replace(" ", "T"));
      if (!Number.isNaN(t)) return `t:${t}`;
    }
    const n = v.trim() === "" ? NaN : Number(v);
    return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v.trim()) ? `n:${n}` : `s:${v}`;
  }
  if (typeof v === "boolean") return `b:${v}`;
  return `j:${JSON.stringify(v)}`;
}
