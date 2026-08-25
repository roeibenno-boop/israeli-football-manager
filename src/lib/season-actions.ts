// Shared season-lifecycle orchestration: Restart, end-of-season rollover
// (same club or a different one), and the very first club claim all funnel
// through the functions here. A deliberate exception to the usual "lib/
// stays pure, I/O lives in the screen" split (CLAUDE.md's Conventions) --
// this exact sequence of writes is identical across three different
// screens (app/settings.tsx, app/season-summary.tsx, app/pick-club.tsx), so
// it lives once here rather than being copy-pasted three times. The pure
// pieces (aging, reset defaults) still live in season.ts.

import { generateSeasonFixtures } from './fixtures';
import { applyAgeProgression, clubSeasonReset, playerSeasonReset } from './season';
import { supabase } from './supabase';
import type { Player } from '../types';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type ArchiveSeasonInput = {
  seasonId: string;
  finalPosition: number | null;
  finalPoints: number | null;
};

/** Marks a season's row inactive/ended -- a natural end-of-season (with a final position/points) or a Restart (both null, since a wipe isn't a finish). */
export async function archiveSeason({ seasonId, finalPosition, finalPoints }: ArchiveSeasonInput): Promise<void> {
  const { error } = await supabase
    .from('seasons')
    .update({
      is_active: false,
      ended_at: new Date().toISOString(),
      final_position: finalPosition,
      final_points: finalPoints,
    })
    .eq('id', seasonId);
  if (error) throw error;
}

/** Deletes a season's own fixtures + player_match_stats outright -- Restart only; a natural rollover keeps them (under the now-archived season_id) for career history. */
export async function wipeSeasonRecord(seasonId: string): Promise<void> {
  const { error: statsError } = await supabase.from('player_match_stats').delete().eq('season_id', seasonId);
  if (statsError) throw statsError;
  const { error: fixturesError } = await supabase.from('fixtures').delete().eq('season_id', seasonId);
  if (fixturesError) throw fixturesError;
}

/** Highest season_number this profile has ever had, or 0 if this is their first ever. */
export async function latestSeasonNumber(profileId: string): Promise<number> {
  const { data, error } = await supabase
    .from('seasons')
    .select('season_number')
    .eq('profile_id', profileId)
    .order('season_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0].season_number : 0;
}

export async function setProfileSeason(
  profileId: string,
  clubId: string | null,
  seasonId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ managed_club_id: clubId, current_season_id: seasonId })
    .eq('id', profileId);
  if (error) throw error;
}

/**
 * Resets every player and club in the league to their fresh-season state --
 * this is a single shared league table (CLAUDE.md's RLS note), so "every
 * player" really does mean every player at every club, not just the
 * manager's own squad. When `age` is true (a genuine season rollover, not
 * a Restart), also ages every player a year and recomputes their rating
 * via season.ts's applyAgeProgression.
 */
export async function resetLeagueState(age: boolean): Promise<void> {
  const [{ data: players, error: playersError }, { data: clubs, error: clubsError }] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('clubs').select('id'),
  ]);
  if (playersError) throw playersError;
  if (clubsError) throw clubsError;

  const playerUpdates = (players ?? []).map((p: Player) => {
    const reset = playerSeasonReset();
    if (!age) return { id: p.id, ...reset };
    const progressed = applyAgeProgression({
      id: p.id,
      overall: p.overall,
      potential: p.potential,
      age: p.age,
      position: p.position,
    });
    return { id: p.id, ...reset, ...progressed };
  });

  for (const batch of chunk(playerUpdates, 20)) {
    await Promise.all(batch.map(({ id, ...fields }) => supabase.from('players').update(fields).eq('id', id)));
  }

  const clubReset = clubSeasonReset();
  for (const batch of chunk((clubs ?? []).map((c) => c.id), 20)) {
    await Promise.all(batch.map((id) => supabase.from('clubs').update(clubReset).eq('id', id)));
  }
}

/** Generates a fresh double round-robin for every club currently in the league, tagged with `seasonId`. */
export async function generateFixturesForSeason(seasonId: string): Promise<void> {
  const { data: clubs, error: clubsError } = await supabase.from('clubs').select('id').order('name');
  if (clubsError) throw clubsError;
  if (!clubs || clubs.length === 0 || clubs.length % 2 !== 0) {
    throw new Error(`Need an even, non-zero number of clubs to generate a season (found ${clubs?.length ?? 0}).`);
  }

  // Next Friday at 19:00 -- same "good enough for a dev season" heuristic
  // as scripts/generate-fixtures.ts.
  const seasonStart = new Date();
  seasonStart.setUTCDate(seasonStart.getUTCDate() + ((5 - seasonStart.getUTCDay() + 7) % 7 || 7));
  seasonStart.setUTCHours(19, 0, 0, 0);

  const fixtures = generateSeasonFixtures({ clubIds: clubs.map((c) => c.id), seasonStart }).map((f) => ({
    ...f,
    season_id: seasonId,
  }));

  const { error: insertError } = await supabase.from('fixtures').insert(fixtures);
  if (insertError) throw insertError;
}

export type CreateSeasonInput = { profileId: string; clubId: string; seasonNumber: number };

async function createSeason({ profileId, clubId, seasonNumber }: CreateSeasonInput): Promise<string> {
  const { data, error } = await supabase
    .from('seasons')
    .insert({ profile_id: profileId, club_id: clubId, season_number: seasonNumber, is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export type StartNewSeasonOptions = {
  profileId: string;
  clubId: string;
  seasonNumber: number;
  /** True for a genuine season rollover (players age a year); false for a Restart or a first-ever club claim. */
  age: boolean;
};

/**
 * The common tail of every "start a season" flow: create the season row,
 * reset (and optionally age) every player/club in the league, generate a
 * fresh fixture list, and point the profile at all of it. Callers are
 * responsible for archiving/wiping whatever came before, first -- see
 * app/settings.tsx (Restart), app/season-summary.tsx (rollover), and
 * app/pick-club.tsx (claim), which each call this the same way but differ
 * in what they do before calling it.
 */
export async function startNewSeason({ profileId, clubId, seasonNumber, age }: StartNewSeasonOptions): Promise<string> {
  const seasonId = await createSeason({ profileId, clubId, seasonNumber });
  await resetLeagueState(age);
  await generateFixturesForSeason(seasonId);
  await setProfileSeason(profileId, clubId, seasonId);
  return seasonId;
}
