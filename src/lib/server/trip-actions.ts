"use server";
// The golfer's trip for the Flights page: where they're flying from (the airport nearest them, worked out in the
// browser; their coordinates never reach here) and where to (the airport for the course they picked, or one they
// searched). The same door as the journal: Clerk auth() → Supabase with the publishable key + the golfer's token →
// RLS (trips: four policies on user_id). No secret key. The airport codes must exist in public.airports (checked
// here for a friendly message, and by the foreign keys regardless).
import { SignedOutError, supabaseForUser } from "./supabase";

export type Trip = { from: string; to: string; label: string | null; updatedAt: string };
export type TripResult = { ok: true; trip: Trip | null } | { ok: false; error: string };

const CODE = /^[A-Z0-9]{3}$/;
type Row = { from_airport: string; to_airport: string; dest_label: string | null; updated_at: string };
const toTrip = (r: Row): Trip => ({ from: r.from_airport, to: r.to_airport, label: r.dest_label, updatedAt: r.updated_at });

/** This golfer's saved trip, or null if they haven't planned one. */
export async function getTrip(): Promise<TripResult> {
  try {
    const { db } = await supabaseForUser();
    const { data, error } = await db.from("trips").select("from_airport, to_airport, dest_label, updated_at").maybeSingle<Row>();
    if (error) return { ok: false, error: `Couldn't load your trip (${error.code ?? "db"}). Try again in a moment.` };
    return { ok: true, trip: data ? toTrip(data) : null };
  } catch (e) {
    return { ok: false, error: e instanceof SignedOutError ? "Sign in to plan a trip." : "Couldn't load your trip. Try again in a moment." };
  }
}

/** Save the trip: from and to are IATA codes ("ORD", "SAN"); label is what the golfer picked ("Fairbanks Ranch"). */
export async function setTrip(from: string, to: string, label: string | null): Promise<TripResult> {
  const f = typeof from === "string" ? from.trim().toUpperCase() : "";
  const t = typeof to === "string" ? to.trim().toUpperCase() : "";
  if (!CODE.test(f) || !CODE.test(t)) return { ok: false, error: "Those aren't airport codes we know." };
  const l = typeof label === "string" ? label.trim().replace(/\s+/g, " ").slice(0, 80) || null : null;
  try {
    const { db, userId } = await supabaseForUser();
    const known = await db.from("airports").select("code").in("code", [f, t]);
    if (known.error) return { ok: false, error: `Couldn't check those airports (${known.error.code ?? "db"}). Try again.` };
    if (new Set((known.data ?? []).map((r) => r.code as string)).size !== new Set([f, t]).size) {
      return { ok: false, error: "We don't have that airport. Try a major airport nearby." };
    }
    const { data, error } = await db
      .from("trips")
      .upsert({ user_id: userId, from_airport: f, to_airport: t, dest_label: l, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("from_airport, to_airport, dest_label, updated_at")
      .single<Row>();
    if (error) return { ok: false, error: `Couldn't save your trip (${error.code ?? "db"}). Try again in a moment.` };
    return { ok: true, trip: toTrip(data) };
  } catch (e) {
    return { ok: false, error: e instanceof SignedOutError ? "Sign in to plan a trip." : "Couldn't save your trip. Try again in a moment." };
  }
}
