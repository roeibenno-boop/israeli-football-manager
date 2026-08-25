-- 0010_seasons.sql
-- Season lifecycle: restart, end-of-season club switching, and rollover.
-- (Requested as 0006_seasons.sql; 0006 was already used -- renumbered to
-- the next free slot, same pattern as every migration since 0002.)

create table public.seasons (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  season_number   smallint not null,
  club_id         uuid not null references public.clubs (id),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  final_position  smallint,
  final_points    smallint,
  is_active       boolean not null default true
);

create index seasons_profile_id_idx on public.seasons (profile_id);

alter table public.profiles
  add column current_season_id uuid references public.seasons (id) on delete set null;

-- Scope fixtures + player_match_stats to a season so multiple seasons (and,
-- in principle, multiple managers' independent careers) coexist cleanly
-- instead of one global fixture list forever. Nullable rather than
-- not-null: pre-0010 rows predate seasons entirely and get backfilled
-- below, but a hard not-null constraint isn't worth the risk of failing
-- this migration on a database this project has never seen (a fresh
-- install with zero existing rows backfills to nothing, which is fine).
alter table public.fixtures
  add column season_id uuid references public.seasons (id) on delete cascade;

alter table public.player_match_stats
  add column season_id uuid references public.seasons (id) on delete cascade;

create index fixtures_season_id_idx on public.fixtures (season_id);
create index player_match_stats_season_id_idx on public.player_match_stats (season_id);

-- ---------------------------------------------------------------------------
-- Backfill: every profile that had already claimed a club gets a season 1
-- row (matching its club), fixtures/player_match_stats predating seasons
-- (shared league-wide state under the old model -- see CLAUDE.md) all
-- attach to whichever season row was created first, since there was only
-- ever one global fixture list before this migration.
-- ---------------------------------------------------------------------------
insert into public.seasons (profile_id, season_number, club_id, started_at, is_active)
select p.id, 1, p.managed_club_id, now(), true
from public.profiles p
where p.managed_club_id is not null;

update public.profiles p
set current_season_id = s.id
from public.seasons s
where s.profile_id = p.id and s.season_number = 1 and p.current_season_id is null;

update public.fixtures f
set season_id = (select id from public.seasons order by started_at asc limit 1)
where f.season_id is null
  and exists (select 1 from public.seasons);

update public.player_match_stats pms
set season_id = (select id from public.seasons order by started_at asc limit 1)
where pms.season_id is null
  and exists (select 1 from public.seasons);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.seasons enable row level security;

create policy "seasons are readable by their owner"
  on public.seasons for select
  to authenticated
  using (auth.uid() = profile_id);

create policy "seasons are insertable by their owner"
  on public.seasons for insert
  to authenticated
  with check (auth.uid() = profile_id);

create policy "seasons are updatable by their owner"
  on public.seasons for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Restart/rollover need to regenerate and wipe fixtures/player_match_stats
-- from a plain authenticated session, same "shared, single-player-for-now"
-- reasoning as the existing fixtures/player_match_stats update policies
-- (0007_tactics.sql / 0008_performance.sql) -- there was no insert/delete
-- policy for fixtures at all before this, and no delete policy for
-- player_match_stats.
create policy "fixtures are insertable by any authenticated user"
  on public.fixtures for insert
  to authenticated
  with check (true);

create policy "fixtures are deletable by any authenticated user"
  on public.fixtures for delete
  to authenticated
  using (true);

create policy "player match stats are deletable by any authenticated user"
  on public.player_match_stats for delete
  to authenticated
  using (true);
