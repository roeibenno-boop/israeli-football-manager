-- 0003_players_age.sql
-- Transfermarkt's bulk squad view exposes age, not exact date of birth, at scale.
-- Rather than fabricate a birth_date, store age directly and make birth_date
-- optional for when a real date is known later.

alter table public.players
  alter column birth_date drop not null,
  add column age integer;
