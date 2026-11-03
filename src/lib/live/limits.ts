// How many each golfer may follow or watch. The database enforces the same numbers (before-insert triggers in
// supabase/migrations/20261102130500_followed_players.sql and 20261102170200_watched_categories.sql).
export const MAX_PLAYERS = 20;
export const MAX_CATEGORIES = 4;
