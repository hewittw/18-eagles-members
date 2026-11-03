// How many tour players each golfer may follow. The database enforces the same number (a before-insert trigger in
// supabase/migrations/20261102130500_followed_players.sql).
export const MAX_PLAYERS = 20;
