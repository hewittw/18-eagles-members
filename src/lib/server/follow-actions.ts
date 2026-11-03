"use server";
// Server Actions for following tour players and watching Pro Shop categories. The same door as the journal
// (club-actions.ts): Clerk auth() → Supabase with the publishable key + the golfer's token → RLS. No secret key, ever.
// Reads have no user_id filter: RLS returns only this golfer's rows. The limits (20 players, 4 categories) are
// enforced by triggers in the database; the friendly messages below just put their errors into words.
import { MAX_CATEGORIES, MAX_PLAYERS } from "../live/limits";
import { playerKey } from "../live/playerKey";
import { CATEGORY_IDS } from "../live/shop";
import { SignedOutError, supabaseForUser } from "./supabase";

export type FollowResult = { ok: true } | { ok: false; error: string };

type DbError = { code?: string; message?: string } | null;
type Kind = "player" | "category";

const KEY_RE = /^[a-z]+(-[a-z]+)*$/;

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

/** Watch a Pro Shop category ("balls"): its deals come first. Must be one of the fixed six. */
export async function watchCategory(category: string): Promise<FollowResult> {
  if (typeof category !== "string" || !CATEGORY_IDS.has(category)) return { ok: false, error: "That isn't a category we can watch." };
  return run("category", async (db, userId) =>
    db.from("watched_categories").upsert({ user_id: userId, category }, { onConflict: "user_id,category", ignoreDuplicates: true }),
  );
}

/** Stop watching a category. Unwatching one not watched is fine. */
export async function unwatchCategory(category: string): Promise<FollowResult> {
  if (typeof category !== "string" || !CATEGORY_IDS.has(category)) return { ok: false, error: "That isn't a category we can stop watching." };
  return run("category", async (db) => db.from("watched_categories").delete().eq("category", category));
}

type Db = Awaited<ReturnType<typeof supabaseForUser>>["db"];

async function run(kind: Kind, write: (db: Db, userId: string) => PromiseLike<{ error: DbError }>): Promise<FollowResult> {
  try {
    const { db, userId } = await supabaseForUser();
    const { error } = await write(db, userId);
    return error ? { ok: false, error: friendly(kind, error) } : { ok: true };
  } catch (e) {
    if (e instanceof SignedOutError) return { ok: false, error: kind === "player" ? "Sign in to follow players." : "Sign in to keep a watch list." };
    return { ok: false, error: "Couldn't save that. Try again in a moment." };
  }
}

function friendly(kind: Kind, e: NonNullable<DbError>): string {
  if (e.message?.includes("follow_limit")) {
    return kind === "player"
      ? `You're following ${MAX_PLAYERS} players, the most we keep. Unfollow one to add another.`
      : `You're watching ${MAX_CATEGORIES} categories, the most we keep. Stop watching one to add another.`;
  }
  if (e.code === "23514") return kind === "player" ? "That player's name is too long to follow." : "That isn't a category we can watch.";
  return `Couldn't save that (${e.code ?? "db"}). Try again in a moment.`;
}
