// Fatigue: a hidden 0-100 points counter drives three discrete, UI-facing
// states. Pure functions -- no I/O, no Supabase. The points value is
// internal plumbing (persisted in players.fatigue_points); screens should
// only ever render the state (players.fatigue_level) and the effective
// overall it produces.

export type FatigueLevel = 'fresh' | 'moderate' | 'tired';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fatigueLevelForPoints(points: number): FatigueLevel {
  if (points <= 33) return 'fresh';
  if (points <= 66) return 'moderate';
  return 'tired';
}

/** Age adjustment shared by accumulation (direct) and recovery (inverted). */
function ageFactor(age: number): number {
  if (age > 31) return 1.3;
  if (age < 23) return 0.85;
  return 1;
}

/**
 * A full 90 minutes moves a fresh player (0) to ~40 points -- into
 * 'moderate'. A second full match on top of that pushes a player into
 * 'tired' territory.
 */
export function accumulateFatigue(points: number, minutesPlayed: number, age: number): number {
  const gain = (minutesPlayed / 90) * 40 * ageFactor(age);
  return clamp(points + gain, 0, 100);
}

/**
 * Older players recover slower, younger players faster -- the same age
 * factor as accumulation, inverted (a bigger accumulation multiplier
 * becomes a smaller recovery multiplier). ~4-5 rest days (a normal week
 * between rounds) brings a 'moderate' (~40-66) player back to 'fresh'.
 */
export function recoverFatigue(points: number, restDays: number, age: number): number {
  const recovery = restDays * 14 * (1 / ageFactor(age));
  return clamp(points - recovery, 0, 100);
}

/**
 * 'fresh': no change. 'moderate': -4. 'tired': -11 -- meant to hurt, not
 * a nudge. Floored at 40 regardless of how low the true overall is.
 */
export function effectiveOverall(overall: number, fatigueLevel: FatigueLevel): number {
  const penalty = fatigueLevel === 'fresh' ? 0 : fatigueLevel === 'moderate' ? 4 : 11;
  return Math.max(40, overall - penalty);
}

export function injuryRiskForLevel(level: FatigueLevel): number {
  return level === 'fresh' ? 0.01 : level === 'moderate' ? 0.03 : 0.08;
}

/**
 * Deterministic given `rng` (caller supplies a seeded PRNG -- see
 * simulation.ts's makeRng -- so injuries are reproducible from a match
 * seed like everything else in the sim). Returns the injury's duration in
 * whole weeks (1-4), or null if no injury occurred.
 */
export function rollInjury(level: FatigueLevel, rng: () => number): number | null {
  if (rng() >= injuryRiskForLevel(level)) return null;
  return 1 + Math.floor(rng() * 4); // 1..4
}
