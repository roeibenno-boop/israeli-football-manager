-- 0009_match_odds.sql
-- Form/momentum for the Davidson match outcome model (src/lib/matchOdds.ts).

alter table public.clubs
  add column form_string text check (form_string ~ '^[WDL]{0,5}$'),
  add column momentum numeric(4, 2);
