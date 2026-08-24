-- 0007_tactics.sql
-- Lineups/tactics + linking fixtures to the lineups used in them.
-- (Requested as 0004_tactics.sql, but 0004 was already used -- renumbered
-- to the next free slot, same pattern as 0002/0003/0005/0006 before it.)

create table public.lineups (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  formation   text not null check (formation in ('4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2')),
  created_at  timestamptz not null default now()
);

create index lineups_profile_id_idx on public.lineups (profile_id);

create table public.lineup_slots (
  lineup_id   uuid not null references public.lineups (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  slot_key    text not null,
  is_starter  boolean not null default true,
  primary key (lineup_id, slot_key)
);

create index lineup_slots_lineup_id_idx on public.lineup_slots (lineup_id);
create index lineup_slots_player_id_idx on public.lineup_slots (player_id);

alter table public.fixtures
  add column attendance integer,
  add column home_lineup_id uuid references public.lineups (id) on delete set null,
  add column away_lineup_id uuid references public.lineups (id) on delete set null,
  -- Not explicitly requested, but needed to make "tap a fixture for its
  -- match event timeline" actually correct: src/lib/simulation.ts is
  -- deterministic given the same inputs, but squads/lineups can change
  -- after a match is played, so re-simulating on demand could show a
  -- timeline whose goal tally doesn't match the stored score. Persisting
  -- the events avoids that.
  add column events jsonb;

-- RLS: a manager's lineups are their own business (owner-only), matching
-- the profiles pattern -- no public read, since a lineup leaks nothing
-- useful to an opponent's manager anyway at this stage of the game.
alter table public.lineups enable row level security;
alter table public.lineup_slots enable row level security;

create policy "lineups are readable by their owner"
  on public.lineups for select
  to authenticated
  using (auth.uid() = profile_id);

create policy "lineups are insertable by their owner"
  on public.lineups for insert
  to authenticated
  with check (auth.uid() = profile_id);

create policy "lineups are updatable by their owner"
  on public.lineups for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "lineups are deletable by their owner"
  on public.lineups for delete
  to authenticated
  using (auth.uid() = profile_id);

-- lineup_slots has no profile_id of its own -- authorize via a join back to
-- the parent lineup's owner.
create policy "lineup slots are readable by the lineup's owner"
  on public.lineup_slots for select
  to authenticated
  using (exists (select 1 from public.lineups l where l.id = lineup_id and l.profile_id = auth.uid()));

create policy "lineup slots are insertable by the lineup's owner"
  on public.lineup_slots for insert
  to authenticated
  with check (exists (select 1 from public.lineups l where l.id = lineup_id and l.profile_id = auth.uid()));

create policy "lineup slots are updatable by the lineup's owner"
  on public.lineup_slots for update
  to authenticated
  using (exists (select 1 from public.lineups l where l.id = lineup_id and l.profile_id = auth.uid()))
  with check (exists (select 1 from public.lineups l where l.id = lineup_id and l.profile_id = auth.uid()));

create policy "lineup slots are deletable by the lineup's owner"
  on public.lineup_slots for delete
  to authenticated
  using (exists (select 1 from public.lineups l where l.id = lineup_id and l.profile_id = auth.uid()));

-- fixtures/the league table is shared, single-world state -- not owned by
-- any one manager the way profiles/lineups are (playing your round can
-- finish other managers' matches too, in the same round). No per-owner
-- policy fits that. Same known simplification as club-claiming
-- (documented in CLAUDE.md): any signed-in user can record match results,
-- since this is still effectively single-player. Revisit before any real
-- multi-user use.
create policy "fixtures are updatable by any authenticated user"
  on public.fixtures for update
  to authenticated
  using (true)
  with check (true);
