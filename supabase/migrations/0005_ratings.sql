-- 0005_ratings.sql
-- Player rating system: overall/potential/attributes, computed by
-- src/lib/ratings.ts and written by scripts/backfill-ratings.ts.
-- (Requested as 0002_ratings.sql, but 0002 was already used for seed data —
-- renumbered to the next free slot in the migration sequence.)

alter table public.players
  add column overall smallint,
  add column potential smallint,
  add column pace smallint,
  add column shooting smallint,
  add column passing smallint,
  add column dribbling smallint,
  add column defending smallint,
  add column physical smallint,
  add column preferred_foot text check (preferred_foot in ('left', 'right', 'both')),
  add column height_cm smallint;
