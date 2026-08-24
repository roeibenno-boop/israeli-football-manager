// Pure, deterministic rating engine: no I/O, no Supabase, no React. Given the
// same inputs it always returns the same outputs — required both for unit
// testing and so scripts/backfill-ratings.ts is idempotent (re-running it
// recomputes and overwrites the same values, rather than drifting).
//
// Signature note: computeOverall takes `age` rather than `birthDate`.
// Transfermarkt's bulk squad data (what seeded our players) only gives age,
// not exact birth dates — see players.age in 0003_players_age.sql. Pass
// `ageFromBirthDate(birthDate)` if you only have a real birth_date.

import type { PlayerPosition } from '../types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Turns an exact birth date into an age in whole years, as of `asOf` (defaults to now). */
export function ageFromBirthDate(birthDate: string, asOf: Date = new Date()): number {
  const birth = new Date(birthDate);
  let age = asOf.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

// --- deterministic pseudo-randomness -----------------------------------
// Not real randomness: a hash + a small PRNG, so the "random" variance in
// computePotential/deriveAttributes is 100% reproducible from its inputs.

function hashString(input: string): number {
  // FNV-1a, 32-bit.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — deterministic PRNG, returns a float in [0, 1). */
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// --- overall / potential -------------------------------------------------

/**
 * base = 58 + 10 * log10(marketValueEur / 50000), then an age adjustment:
 * under 21 (value inflated by potential): -2. Over 32 (value decays faster
 * than ability): +3. Clamped to [45, 88].
 *
 * `position` is accepted for interface symmetry / future position-specific
 * tuning but the current formula is position-independent.
 */
export function computeOverall(marketValueEur: number, age: number, position: PlayerPosition): number {
  void position;

  const safeValue = Math.max(0, marketValueEur);
  const base = 58 + 10 * Math.log10(safeValue / 50000);

  let adjusted: number;
  if (age < 21) adjusted = base - 2;
  else if (age <= 32) adjusted = base;
  else adjusted = base + 3;

  return clamp(Math.round(adjusted), 45, 88);
}

/**
 * Younger players have more room to grow. The "random" spread is derived
 * deterministically from (overall, age) — same inputs, same output, so
 * this stays pure and backfills stay idempotent.
 */
export function computePotential(overall: number, age: number): number {
  const rand = seededRandom(overall * 1000 + age);

  let bump: number;
  if (age <= 19) bump = 6 + Math.round(rand * 6); // 6..12
  else if (age <= 23) bump = 3 + Math.round(rand * 4); // 3..7
  else if (age <= 27) bump = Math.round(rand * 3); // 0..3
  else bump = 0;

  return clamp(overall + bump, overall, 92);
}

// --- attributes ------------------------------------------------------------

export type AttributeKey = 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical';
export type PlayerAttributes = Record<AttributeKey, number>;

const ATTRIBUTE_KEYS: AttributeKey[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];

// Offsets from `overall`, per position — strong attributes above, weak ones
// below. A GK's shooting is far below overall; a CB/FB's pace and shooting
// are both below overall while defending is well above; a FW is the mirror
// image. These are hand-picked, not derived from data.
const POSITION_WEIGHTS: Record<PlayerPosition, PlayerAttributes> = {
  GK: { pace: -8, shooting: -25, passing: -5, dribbling: -15, defending: 5, physical: 5 },
  DF: { pace: -3, shooting: -15, passing: -2, dribbling: -8, defending: 12, physical: 8 },
  MF: { pace: 0, shooting: -5, passing: 10, dribbling: 5, defending: 0, physical: 0 },
  FW: { pace: 8, shooting: 12, passing: -5, dribbling: 8, defending: -15, physical: 2 },
};

/**
 * Spreads the six attributes around `overall` using position weights, plus
 * small (-3..+3) deterministic variance seeded from `playerId` so the same
 * player always gets the same numbers. Every attribute clamped to [30, 95].
 */
export function deriveAttributes(overall: number, position: PlayerPosition, playerId: string): PlayerAttributes {
  const weights = POSITION_WEIGHTS[position];
  const attributes = {} as PlayerAttributes;

  for (const key of ATTRIBUTE_KEYS) {
    const seed = hashString(`${playerId}:${key}`);
    const variance = Math.round((seededRandom(seed) - 0.5) * 6); // -3..+3
    attributes[key] = clamp(Math.round(overall + weights[key] + variance), 30, 95);
  }

  return attributes;
}

// --- club rating -------------------------------------------------------

export type RatedPlayer = { position: PlayerPosition; overall: number };
export type ClubRating = { overall: number; attack: number; midfield: number; defence: number };

/**
 * Best 11 by overall, then: attack/midfield/defence are the FW/MF/DF
 * averages within that XI, and overall is their weighted mean
 * (GK 15%, DF 30%, MF 30%, FW 25%). A position with nobody in the XI
 * (e.g. no GK made the cut) averages to 0 and still counts at its full
 * weight — a known simplification for this data-layer-only step.
 */
export function computeClubRating(players: RatedPlayer[]): ClubRating {
  const bestXI = [...players].sort((a, b) => b.overall - a.overall).slice(0, 11);
  const overallsFor = (pos: PlayerPosition) => bestXI.filter((p) => p.position === pos).map((p) => p.overall);

  const gk = average(overallsFor('GK'));
  const df = average(overallsFor('DF'));
  const mf = average(overallsFor('MF'));
  const fw = average(overallsFor('FW'));

  return {
    overall: Math.round(gk * 0.15 + df * 0.3 + mf * 0.3 + fw * 0.25),
    attack: Math.round(fw),
    midfield: Math.round(mf),
    defence: Math.round(df),
  };
}
