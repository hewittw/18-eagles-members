// diffRows decides what the worker writes. Every write becomes a Realtime message to every open page, so it must
// return nothing when nothing changed, and exactly the new/changed/gone rows when something did.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffRows, sameValue } from "../_shared/diff.ts";

type Row = { player_key: string; position: string | null; to_par: string | null; sort_order: number | null; updated_at?: string };
const FIELDS = ["position", "to_par", "sort_order"] as const;
const A: Row[] = [
  { player_key: "scottie-scheffler", position: "1", to_par: "-12", sort_order: 1 },
  { player_key: "rory-mcilroy", position: "T2", to_par: "-10", sort_order: 2 },
  { player_key: "xander-schauffele", position: "T2", to_par: "-10", sort_order: 3 },
];

// The common case (no score moved in 10 s): the same response twice must write nothing.
test("the same rows twice give no upserts and no deletes", () => {
  const d = diffRows(A, A.map((r) => ({ ...r })), "player_key", FIELDS);
  assert.deepEqual(d, { upserts: [], deletes: [] });
});

// A first run (nothing saved yet) must save every row.
test("with nothing saved, every incoming row is an upsert", () => {
  const d = diffRows<Row, "player_key">([], A, "player_key", FIELDS);
  assert.equal(d.upserts.length, 3);
  assert.deepEqual(d.deletes, []);
});

// A then B: one changed, one new, one gone. Only those are written; the unchanged row is left alone.
test("A then B: only changed and new rows upsert, and the missing row is deleted", () => {
  const B: Row[] = [
    { player_key: "scottie-scheffler", position: "1", to_par: "-13", sort_order: 1 }, // changed
    { player_key: "rory-mcilroy", position: "T2", to_par: "-10", sort_order: 2 }, // same
    { player_key: "tommy-fleetwood", position: "4", to_par: "-9", sort_order: 4 }, // new
  ];
  const d = diffRows(A, B, "player_key", FIELDS);
  assert.deepEqual(d.upserts.map((r) => r.player_key), ["scottie-scheffler", "tommy-fleetwood"]);
  assert.deepEqual(d.deletes, [{ player_key: "xander-schauffele" }]);
});

// Rankings come 200 at a time: a player outside this page isn't "gone", so the caller can turn deletes off.
test("deleteMissing: false never deletes", () => {
  const d = diffRows(A, A.slice(0, 1), "player_key", FIELDS, { deleteMissing: false });
  assert.deepEqual(d, { upserts: [], deletes: [] });
});

// Columns the database fills in (updated_at) aren't in `fields`, so they never count as a change.
test("only the listed fields are compared", () => {
  const saved = A.map((r) => ({ ...r, updated_at: "2026-11-02T10:00:00Z" }));
  const d = diffRows(saved, A, "player_key", FIELDS);
  assert.equal(d.upserts.length, 0);
});

// Flights use (airport, hex): the same plane near two airports is two rows, and deletes return both key columns.
test("composite keys identify rows by every key column", () => {
  type F = { airport: string; hex: string; alt_ft: number };
  const saved: F[] = [{ airport: "ORD", hex: "a1", alt_ft: 3000 }, { airport: "MDW", hex: "a1", alt_ft: 3000 }];
  const next: F[] = [{ airport: "ORD", hex: "a1", alt_ft: 4000 }];
  const d = diffRows(saved, next, ["airport", "hex"], ["alt_ft"]);
  assert.deepEqual(d.upserts, [{ airport: "ORD", hex: "a1", alt_ft: 4000 }]);
  assert.deepEqual(d.deletes, [{ airport: "MDW", hex: "a1" }]);
});

// A source can list the same row twice; one upsert statement can't touch a row twice, so the last one wins.
test("duplicate incoming keys collapse to the last one", () => {
  const d = diffRows<Row, "player_key">([], [A[0], { ...A[0], to_par: "-14" }], "player_key", FIELDS);
  assert.equal(d.upserts.length, 1);
  assert.equal(d.upserts[0].to_par, "-14");
});

// What Postgres hands back isn't byte-identical to what we sent; those round-trip differences must not count as changes.
test("database round-trips compare equal: null/undefined, number/numeric string, ISO instants, JSON", () => {
  assert.ok(sameValue(null, undefined));
  assert.ok(sameValue(12.5, "12.5"));
  assert.ok(sameValue("2026-11-02T10:00:00.000Z", "2026-11-02T10:00:00+00:00"));
  assert.ok(sameValue({ a: 1 }, { a: 1 }));
  assert.ok(!sameValue("T2", "2"));
  assert.ok(!sameValue("-10", "-1"));
  assert.ok(!sameValue(0, null));
  assert.ok(!sameValue("", null));
});
