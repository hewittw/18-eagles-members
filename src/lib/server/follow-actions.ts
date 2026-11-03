"use server";
// Server Actions for following tour players. The same door as the journal
// (club-actions.ts): Clerk auth() → Supabase with the publishable key + the golfer's token → RLS. No secret key, ever.
// Reads have no user_id filter: RLS returns only this golfer's rows. The limit (20 players) is enforced by a
// trigger in the database; the friendly messages below just put its errors into words.
import { MAX_PLAYERS } from "../live/limits";
import { playerKey } from "../live/playerKey";
import { SignedOutError, supabaseForUser } from "./supabase";

export type FollowResult = { ok: true } | { ok: false; error: string };

type DbError = { code?: string; message?: string } | null;

const KEY_RE = /^[a-z]+(-[a-z]+)*$/;

/** Follow a tour player by their display name ("Scottie Scheffler"); the key is derived here, as the worker does. */
export async function followPlayer(name: string): Promise<FollowResult> {
  const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  const key = playerKey(clean);
  if (!clean || clean.length > 80 || !key) return { ok: false, error: "That player's name isn't one we can follow." };
  return run(async (db, userId) =>
    db.from("followed_players").upsert({ user_id: userId, player_key: key, name: clean }, { onConflict: "user_id,player_key", ignoreDuplicates: true }),
  );
}

/** Stop following a player, by player_key ("scottie-scheffler"). Unfollowing someone not followed is fine. */
export async function unfollowPlayer(key: string): Promise<FollowResult> {
  if (typeof key !== "string" || key.length > 80 || !KEY_RE.test(key)) return { ok: false, error: "That player isn't one we can unfollow." };
  return run(async (db) => db.from("followed_players").delete().eq("player_key", key));
}

type Db = Awaited<ReturnType<typeof supabaseForUser>>["db"];

async function run(write: (db: Db, userId: string) => PromiseLike<{ error: DbError }>): Promise<FollowResult> {
  try {
    const { db, userId } = await supabaseForUser();
    const { error } = await write(db, userId);
    return error ? { ok: false, error: friendly(error) } : { ok: true };
  } catch (e) {
    if (e instanceof SignedOutError) return { ok: false, error: "Sign in to follow players." };
    return { ok: false, error: "Couldn't save that. Try again in a moment." };
  }
}

function friendly(e: NonNullable<DbError>): string {
  if (e.message?.includes("follow_limit")) {
    return `You're following ${MAX_PLAYERS} players, the most we keep. Unfollow one to add another.`;
  }
  if (e.code === "23514") return "That player's name is too long to follow.";
  return `Couldn't save that (${e.code ?? "db"}). Try again in a moment.`;
}
