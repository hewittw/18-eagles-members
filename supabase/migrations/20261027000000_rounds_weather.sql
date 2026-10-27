-- A card can keep the conditions it was played in (from Open-Meteo, captured when the round starts/finishes).
alter table public.rounds add column weather jsonb check (weather is null or pg_column_size(weather) < 4000);
