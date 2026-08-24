-- 0008_performance.sql
-- Match performance stats + player condition (fatigue/form/injuries/bans).
-- (Requested as 0005_performance.sql; 0005 was already used -- renumbered,
-- same pattern as every migration since 0002.)

create table public.player_match_stats (
  id                 uuid primary key default gen_random_uuid(),
  fixture_id         uuid not null references public.fixtures (id) on delete cascade,
  player_id          uuid not null references public.players (id) on delete cascade,
  club_id            uuid not null references public.clubs (id) on delete cascade,
  minutes_played     smallint not null default 0,
  started            boolean not null default false,
  goals              smallint not null default 0,
  assists            smallint not null default 0,
  shots              smallint not null default 0,
  shots_on_target    smallint not null default 0,
  key_passes         smallint not null default 0,
  passes_attempted   smallint not null default 0,
  passes_completed   smallint not null default 0,
  tackles            smallint not null default 0,
  interceptions      smallint not null default 0,
  duels_won          smallint not null default 0,
  duels_lost         smallint not null default 0,
  saves              smallint not null default 0,
  goals_conceded     smallint not null default 0,
  clean_sheet        boolean not null default false,
  yellow_cards       smallint not null default 0,
  red_cards          smallint not null default 0,
  own_goals          smallint not null default 0,
  penalties_scored   smallint not null default 0,
  penalties_missed   smallint not null default 0,
  match_rating       numeric(3, 1),
  motm               boolean not null default false,
  unique (fixture_id, player_id)
);

create index player_match_stats_player_id_idx on public.player_match_stats (player_id);
create index player_match_stats_fixture_id_idx on public.player_match_stats (fixture_id);
create index player_match_stats_club_id_idx on public.player_match_stats (club_id);

alter table public.players
  add column fatigue_level text not null default 'fresh'
    check (fatigue_level in ('fresh', 'moderate', 'tired')),
  add column fatigue_points smallint not null default 0,
  add column form numeric(3, 1) default 6.5,
  add column injured_until date,
  add column suspended_matches smallint default 0,
  add column season_goals smallint not null default 0,
  add column season_assists smallint not null default 0,
  add column season_apps smallint not null default 0,
  add column season_minutes integer not null default 0;

alter table public.clubs
  add column current_rating smallint;

-- RLS
alter table public.player_match_stats enable row level security;

create policy "player match stats are publicly readable"
  on public.player_match_stats for select
  to public
  using (true);

-- Match processing ("Play Next Match") writes stats for all 22 players
-- across both sides of every fixture in a round, from a plain user
-- session -- same shared-world reasoning and same known simplification as
-- the fixtures update policy in 0007_tactics.sql.
create policy "player match stats are insertable by any authenticated user"
  on public.player_match_stats for insert
  to authenticated
  with check (true);

create policy "player match stats are updatable by any authenticated user"
  on public.player_match_stats for update
  to authenticated
  using (true)
  with check (true);

-- players/clubs previously had no write policy at all (public.players and
-- public.clubs only had SELECT from 0001_init.sql) -- match processing
-- needs to update fatigue/form/injuries/suspensions/season stats on
-- players, and current_rating on clubs, from that same plain user session.
create policy "players are updatable by any authenticated user"
  on public.players for update
  to authenticated
  using (true)
  with check (true);

create policy "clubs are updatable by any authenticated user"
  on public.clubs for update
  to authenticated
  using (true)
  with check (true);
