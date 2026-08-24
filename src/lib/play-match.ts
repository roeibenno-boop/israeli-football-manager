// Bridges a club's squad (+ optional saved lineup) to the match engine.
// Pure functions -- the actual Supabase fetch/write orchestration lives in
// the Fixtures screen, which has the loading states and error handling
// that belongs in a component, not here.

import { autoPickBestXI, computeLineupRating, type SlotAssignment } from './lineup';
import type { FormationKey } from './formations';
import { simulateMatch, type MatchEvent, type SimPlayer } from './simulation';
import type { Player } from '../types';

export type ClubMatchInputs = {
  formation: FormationKey;
  assignment: SlotAssignment;
};

/** Uses a saved lineup if provided, otherwise auto-picks a default 4-3-3 XI. */
export function buildClubMatchInputs(
  players: Player[],
  savedLineup?: { formation: FormationKey; assignment: SlotAssignment }
): ClubMatchInputs {
  if (savedLineup) return savedLineup;
  const formation: FormationKey = '4-3-3';
  return { formation, assignment: autoPickBestXI(players, formation) };
}

export type SimulatedFixtureResult = {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  /** Cosmetic, deterministic from the fixture id -- not modeled on anything (capacity, form, etc). */
  attendance: number;
};

function deterministicAttendance(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const fraction = (hash >>> 0) / 4294967296;
  return Math.round(8000 + fraction * 34000);
}

function toSimSquad(assignment: SlotAssignment, playersById: Map<string, Player>): SimPlayer[] {
  return Object.values(assignment)
    .filter((id): id is string => id != null)
    .map((id) => playersById.get(id))
    .filter((p): p is Player => p != null)
    .map((p) => ({ id: p.id, name: p.full_name, position: p.position, shooting: p.shooting }));
}

export function simulateFixture(
  fixtureId: string,
  home: ClubMatchInputs,
  away: ClubMatchInputs,
  playersById: Map<string, Player>
): SimulatedFixtureResult {
  const homeRating = computeLineupRating(home.formation, home.assignment, playersById);
  const awayRating = computeLineupRating(away.formation, away.assignment, playersById);

  const result = simulateMatch({
    seed: fixtureId,
    // Fall back to overall if a side's XI happened to have nobody in a
    // group (e.g. no recognized FW) -- avoids feeding a 0 into expectedGoals.
    homeAttack: homeRating.attack || homeRating.overall,
    homeDefence: homeRating.defence || homeRating.overall,
    awayAttack: awayRating.attack || awayRating.overall,
    awayDefence: awayRating.defence || awayRating.overall,
    homeSquad: toSimSquad(home.assignment, playersById),
    awaySquad: toSimSquad(away.assignment, playersById),
  });

  return {
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    events: result.events,
    attendance: deterministicAttendance(fixtureId),
  };
}
