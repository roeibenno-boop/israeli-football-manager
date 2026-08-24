-- 0001_init.sql
-- Foundation schema: clubs, players, fixtures, profiles.
-- No game logic here (standings, transfers, simulation) — just structure.

create extension if not exists pgcrypto; -- provides gen_random_uuid()

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  short_name text not null,
  league     text not null,
  budget     numeric(14, 2) not null default 0,
  logo_url   text
);

comment on table public.clubs is 'Football clubs, e.g. Israeli Premier League (Ligat ha''Al) teams.';

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table public.players (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid references public.clubs (id) on delete set null,
  full_name       text not null,
  position        text not null check (position in ('GK', 'DF', 'MF', 'FW')),
  birth_date      date not null,
  market_value    numeric(14, 2) not null default 0,
  weekly_wage     numeric(14, 2) not null default 0,
  contract_until  date,
  nationality     text not null
);

create index players_club_id_idx on public.players (club_id);

-- ---------------------------------------------------------------------------
-- fixtures
-- ---------------------------------------------------------------------------
create table public.fixtures (
  id            uuid primary key default gen_random_uuid(),
  competition   text not null check (competition in ('league', 'cup')),
  round         integer not null,
  kickoff_at    timestamptz not null,
  home_club_id  uuid not null references public.clubs (id) on delete cascade,
  away_club_id  uuid not null references public.clubs (id) on delete cascade,
  home_goals    integer,
  away_goals    integer,
  status        text not null default 'scheduled'
                  check (status in ('scheduled', 'live', 'finished', 'postponed')),
  constraint fixtures_distinct_clubs check (home_club_id <> away_club_id)
);

create index fixtures_home_club_id_idx on public.fixtures (home_club_id);
create index fixtures_away_club_id_idx on public.fixtures (away_club_id);
create index fixtures_kickoff_at_idx on public.fixtures (kickoff_at);

-- ---------------------------------------------------------------------------
-- profiles (one row per authenticated user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text,
  managed_club_id  uuid references public.clubs (id) on delete set null,
  cash_balance     numeric(14, 2) not null default 0,
  created_at       timestamptz not null default now()
);

create index profiles_managed_club_id_idx on public.profiles (managed_club_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.players enable row level security;
alter table public.fixtures enable row level security;
alter table public.profiles enable row level security;

-- clubs, players, fixtures: world-readable, writes only via service role (server-side).
create policy "clubs are publicly readable"
  on public.clubs for select
  to public
  using (true);

create policy "players are publicly readable"
  on public.players for select
  to public
  using (true);

create policy "fixtures are publicly readable"
  on public.fixtures for select
  to public
  using (true);

-- profiles: owner-only, in both directions.
create policy "profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles are insertable by their owner"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles are updatable by their owner"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles are deletable by their owner"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);
