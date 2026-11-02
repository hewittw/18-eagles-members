"use server";
// Server Actions for following tour players and airports. The same door as the journal (club-actions.ts):
// Clerk auth() → Supabase with the publishable key + the golfer's token → RLS. No secret key, ever. Reads have no
// user_id filter: RLS returns only this golfer's follows. The limits (20 players, 6 airports) are enforced by
// triggers in the database; the friendly messages below just put their errors into words.
import { MAX_AIRPORTS, MAX_PLAYERS } from "../live/limits";
import { playerKey } from "../live/playerKey";
import { SignedOutError, supabaseForUser } from "./supabase";

export type FollowResult = { ok: true } | { ok: false; error: string };
export type FollowedPlayer = { playerKey: string; name: string | null; createdAt: string };
export type FollowedAirport = { airport: string; createdAt: string };
export type Follows = { ok: true; players: FollowedPlayer[]; airports: FollowedAirport[] } | { ok: false; error: string };

type DbError = { code?: string; message?: string } | null;

const KEY_RE = /^[a-z]+(-[a-z]+)*$/;
const AIRPORT_RE = /^[A-Z0-9]{3}$/;

/** Follow a tour player by their display name ("Scottie Scheffler"); the key is derived here, as the worker does. */
export async function followPlayer(name: string): Promise<FollowResult> {
  const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  const key = playerKey(clean);
  if (!clean || clean.length > 80 || !key) return { ok: false, error: "That player's name isn't one we can follow." };
  return run("player", async (db, userId) =>
    db.from("followed_players").upsert({ user_id: userId, player_key: key, name: clean }, { onConflict: "user_id,player_key", ignoreDuplicates: true }),
  );
}

/** Stop following a player, by player_key ("scottie-scheffler"). Unfollowing someone not followed is fine. */
export async function unfollowPlayer(key: string): Promise<FollowResult> {
  if (typeof key !== "string" || key.length > 80 || !KEY_RE.test(key)) return { ok: false, error: "That player isn't one we can unfollow." };
  return run("player", async (db) => db.from("followed_players").delete().eq("player_key", key));
}

/** Follow an airport by IATA code ("ORD"; case doesn't matter). It must be in our airports table. */
export async function followAirport(code: string): Promise<FollowResult> {
  const iata = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!AIRPORT_RE.test(iata)) return { ok: false, error: "Use the airport's three-letter code, like ORD or SAN." };
  return run("airport", async (db, userId) =>
    db.from("followed_airports").upsert({ user_id: userId, airport: iata }, { onConflict: "user_id,airport", ignoreDuplicates: true }),
  );
}

/** Stop following an airport, by IATA code. */
export async function unfollowAirport(code: string): Promise<FollowResult> {
  const iata = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!AIRPORT_RE.test(iata)) return { ok: false, error: "Use the airport's three-letter code, like ORD or SAN." };
  return run("airport", async (db) => db.from("followed_airports").delete().eq("airport", iata));
}

/** Everything this golfer follows, oldest first. */
export async function listFollows(): Promise<Follows> {
  try {
    const { db } = await supabaseForUser();
    const [p, a] = await Promise.all([
      db.from("followed_players").select("player_key, name, created_at").order("created_at", { ascending: true }).limit(MAX_PLAYERS * 2)
        .returns<{ player_key: string; name: string | null; created_at: string }[]>(),
      db.from("followed_airports").select("airport, created_at").order("created_at", { ascending: true }).limit(MAX_AIRPORTS * 2)
        .returns<{ airport: string; created_at: string }[]>(),
    ]);
    const err = p.error ?? a.error;
    if (err) return { ok: false, error: `Couldn't load who you follow (${err.code ?? "db"}). Try again in a moment.` };
    return {
      ok: true,
      players: (p.data ?? []).map((r) => ({ playerKey: r.player_key, name: r.name, createdAt: r.created_at })),
      airports: (a.data ?? []).map((r) => ({ airport: r.airport, createdAt: r.created_at })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof SignedOutError ? "Sign in to see who you follow." : "Couldn't load who you follow. Try again in a moment." };
  }
}

type Db = Awaited<ReturnType<typeof supabaseForUser>>["db"];

async function run(kind: "player" | "airport", write: (db: Db, userId: string) => PromiseLike<{ error: DbError }>): Promise<FollowResult> {
  try {
    const { db, userId } = await supabaseForUser();
    const { error } = await write(db, userId);
    return error ? { ok: false, error: friendly(kind, error) } : { ok: true };
  } catch (e) {
    if (e instanceof SignedOutError) return { ok: false, error: `Sign in to follow ${kind === "player" ? "players" : "airports"}.` };
    return { ok: false, error: "Couldn't save that. Try again in a moment." };
  }
}

function friendly(kind: "player" | "airport", e: NonNullable<DbError>): string {
  if (e.message?.includes("follow_limit")) {
    return kind === "player"
      ? `You're following ${MAX_PLAYERS} players, the most we keep. Unfollow one to add another.`
      : `You're following ${MAX_AIRPORTS} airports, the most we watch. Unfollow one to add another.`;
  }
  if (kind === "airport" && e.code === "23503") return "We don't have that airport. Try a major airport's code, like ORD or SAN.";
  if (e.code === "23514") return kind === "player" ? "That player's name is too long to follow." : "That airport code isn't valid.";
  return `Couldn't save that (${e.code ?? "db"}). Try again in a moment.`;
}
