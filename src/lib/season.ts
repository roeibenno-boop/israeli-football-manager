// Season lifecycle: pure functions for player aging/rating progression and
// the reset defaults applied to players/clubs at a season boundary. No
// Supabase, no React -- src/lib/season-actions.ts is the I/O orchestration
// that calls these (shared across the restart, end-of-season, and
// club-claim flows -- see CLAUDE.md's "Season lifecycle" section).

import { deriveAttributes, type PlayerAttributes } from './ratings';
import type { FatigueLevel, PlayerPosition } from '../types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Same FNV-1a + mulberry32 pair as ratings.ts/simulation.ts/matchOdds.ts --
// deterministic, not Math.random(), so repeated rollovers (or re-running
// this against the same data) are reproducible. Duplicated rather than
// imported, per this project's established module-independence convention.
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// --- player aging / rating progression --------------------------------------

export type AgeProgressionInput = {
  id: string;
  overall: number | null;
  potential: number | null;
  age: number | null;
  position: PlayerPosition;
};

export type AgeProgressionResult = {
  age: number;
  overall: number;
  potential: number;
} & PlayerAttributes;

/**
 * One year of aging + rating progression, applied at every genuine season
 * rollover (not a Restart, which keeps squads untouched -- see
 * season-actions.ts's `age` flag). Three bands: under 24 grows toward their
 * `potential` ceiling (smaller steps the closer they get, so nobody
 * overshoots it in one season), 24-29 is a player's peak (no change), 30+
 * declines, accelerating with age. The growth/decline amount is a
 * deterministic hash of the player's id + their new age (same approach as
 * ratings.ts's computePotential/deriveAttributes), not Math.random(), so
 * rollovers stay reproducible. Attributes are re-derived from the new
 * overall via ratings.ts's deriveAttributes so pace/shooting/etc. shift
 * consistently rather than drifting independently of it.
 */
export function applyAgeProgression(player: AgeProgressionInput): AgeProgressionResult {
  const newAge = (player.age ?? 25) + 1;
  const overall = player.overall ?? 60;
  const potential = player.potential ?? overall;

  const rand = seededRandom(hashString(`${player.id}:age-progression:${newAge}`));
  let newOverall: number;

  if (newAge < 24) {
    const headroom = Math.max(0, potential - overall);
    const growth = Math.round(Math.min(headroom, 1 + rand * 3)); // 1..4, capped at headroom
    newOverall = clamp(overall + growth, overall, potential);
  } else if (newAge <= 29) {
    newOverall = overall; // peak years -- no change
  } else {
    const [lo, hi] = newAge <= 32 ? [1, 2] : newAge <= 35 ? [1, 3] : [2, 4];
    const decline = Math.round(lo + rand * (hi - lo));
    newOverall = clamp(overall - decline, 45, overall);
  }

  return {
    age: newAge,
    overall: newOverall,
    potential,
    ...deriveAttributes(newOverall, player.position, player.id),
  };
}

// --- season-boundary resets --------------------------------------------------

export type PlayerSeasonReset = {
  fatigue_points: number;
  fatigue_level: FatigueLevel;
  form: number;
  injured_until: null;
  suspended_matches: number;
  season_goals: number;
  season_assists: number;
  season_apps: number;
  season_minutes: number;
};

/** Every player's condition/aggregate fields, reset to their fresh-season defaults (0008_performance.sql's own column defaults). */
export function playerSeasonReset(): PlayerSeasonReset {
  return {
    fatigue_points: 0,
    fatigue_level: 'fresh',
    form: 6.5,
    injured_until: null,
    suspended_matches: 0,
    season_goals: 0,
    season_assists: 0,
    season_apps: 0,
    season_minutes: 0,
  };
}

export type ClubSeasonReset = {
  form_string: null;
  momentum: null;
  current_rating: null;
};

/** Every club's form/momentum/rating, reset for a fresh season -- all null until the new season's first fixture is played. */
export function clubSeasonReset(): ClubSeasonReset {
  return { form_string: null, momentum: null, current_rating: null };
}
