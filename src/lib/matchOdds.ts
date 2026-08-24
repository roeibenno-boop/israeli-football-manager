// Exact closed-form Davidson match outcome model. No approximations, no
// probability floors, no post-hoc normalisation — computeOutcomeProbabilities
// sums to exactly 1 by construction (shared denominator) and every outcome
// is strictly positive for all finite D, so there's nothing to clamp.
//
// The only rating input is each side's EFFECTIVE XI rating -- enforced at
// compile time, not runtime: computeDiff takes lineup.ts's
// EffectiveRatingValue (a branded number only computeClubRating can
// produce), so passing player.overall or estimateSquadRating's output is a
// type error, not a lint suggestion. See lineup.ts's brand comment for why
// a runtime check can't do this job (an effective rating and a raw one are
// both just numbers in the same range -- nothing to check at runtime).

import type { EffectiveRatingValue } from './lineup';

export const CONFIG = {
  LAMBDA: 0.16,
  NU: 0.74,
  HOME_ADVANTAGE: 3,
  MU_BASE: 1.3,
  GOAL_TILT: 0.0175,
} as const;

/** D: the Davidson model's single strength differential, home-perspective. */
export function computeDiff(
  homeRating: EffectiveRatingValue,
  awayRating: EffectiveRatingValue,
  homeMomentum: number,
  awayMomentum: number
): number {
  return homeRating + CONFIG.HOME_ADVANTAGE + homeMomentum - (awayRating + awayMomentum);
}

export type OutcomeProbabilities = { pHome: number; pDraw: number; pAway: number };

/**
 * Davidson (1970) model for outcomes with a draw category. h and a scale
 * exponentially with D in opposite directions; nu is the fixed "draw
 * strength" that both sides' exponential terms compete against. The three
 * outcomes share one denominator, so they sum to exactly 1 with no
 * separate normalisation step, and since exp(...) > 0 always, every
 * outcome is strictly positive for every finite D -- there is no D at
 * which the underdog's probability rounds to zero.
 */
export function computeOutcomeProbabilities(D: number): OutcomeProbabilities {
  const h = Math.exp((CONFIG.LAMBDA * D) / 2);
  const a = Math.exp((-CONFIG.LAMBDA * D) / 2);
  const denom = h + a + CONFIG.NU;
  return { pHome: h / denom, pDraw: CONFIG.NU / denom, pAway: a / denom };
}

// --- momentum --------------------------------------------------------------

export type MatchResultLetter = 'W' | 'D' | 'L';

/** W=3, D=1, L=0. Range [0, 15] for a 5-match form string. */
export function computeFormPoints(last5: MatchResultLetter[]): number {
  return last5.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
}

/**
 * 1.5 points/match is the neutral (all-draws) expectation, so
 * `formPoints - 1.5n` is exactly how far above/below neutral a club's
 * recent form is -- this handles early season automatically (n < 5) without
 * a separate case. n=5,F=15 (five wins) -> +3.0 exactly; n=5,F=0 (five
 * losses) -> -3.0 exactly. Kept as a float, no rounding.
 */
export function computeMomentum(formPoints: number, matchesPlayed: number): number {
  const n = Math.min(matchesPlayed, 5);
  return 0.4 * (formPoints - 1.5 * n);
}

// --- exact conditional scoreline sampling -----------------------------------

export type MatchOutcome = 'home' | 'draw' | 'away';

/** Draws an outcome from Davidson probabilities using one uniform draw in [0, 1). */
export function drawOutcome(probs: OutcomeProbabilities, uniform: number): MatchOutcome {
  if (uniform < probs.pHome) return 'home';
  if (uniform < probs.pHome + probs.pDraw) return 'draw';
  return 'away';
}

/** Knuth's algorithm for sampling a Poisson-distributed integer. */
function samplePoissonKnuth(mu: number, rng: () => number): number {
  const limit = Math.exp(-mu);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

const MAX_REJECTIONS = 200;

export type Scoreline = {
  homeGoals: number;
  awayGoals: number;
  outcome: MatchOutcome;
  /** How many (X, Y) pairs were rejected before one matched the drawn outcome (or the fixed fallback if it overflowed). */
  rejections: number;
};

/**
 * Draws the OUTCOME first from the Davidson probabilities, then samples a
 * scoreline conditioned on it via exact rejection sampling: repeatedly draw
 * independent Poisson(muHome)/Poisson(muAway) pairs and accept the first
 * one whose sign(X - Y) matches the drawn outcome. This is exact -- the
 * accepted pair follows the true Poisson distribution conditioned on the
 * outcome, not an approximation of it.
 *
 * Capped at 200 rejections; with these parameters (muHome/muAway both
 * around 1.2-1.4, giving each outcome a substantial share of Poisson mass)
 * this should essentially never trigger. On overflow, falls back to a
 * fixed scoreline per outcome and logs a warning rather than looping
 * forever or silently returning something inconsistent with the drawn
 * outcome.
 */
export function sampleScoreline(D: number, rng: () => number): Scoreline {
  const probs = computeOutcomeProbabilities(D);
  const outcome = drawOutcome(probs, rng());

  const muHome = CONFIG.MU_BASE * Math.exp(CONFIG.GOAL_TILT * D);
  const muAway = CONFIG.MU_BASE * Math.exp(-CONFIG.GOAL_TILT * D);

  for (let rejections = 0; rejections < MAX_REJECTIONS; rejections++) {
    const homeGoals = samplePoissonKnuth(muHome, rng);
    const awayGoals = samplePoissonKnuth(muAway, rng);
    const sign: MatchOutcome = homeGoals > awayGoals ? 'home' : homeGoals < awayGoals ? 'away' : 'draw';
    if (sign === outcome) {
      return { homeGoals, awayGoals, outcome, rejections };
    }
  }

  console.warn(
    `sampleScoreline: exceeded ${MAX_REJECTIONS} rejections for outcome="${outcome}" at D=${D} ` +
      `(muHome=${muHome.toFixed(3)}, muAway=${muAway.toFixed(3)}) -- using a deterministic fallback scoreline.`
  );
  const fallback =
    outcome === 'home' ? { homeGoals: 1, awayGoals: 0 } : outcome === 'away' ? { homeGoals: 0, awayGoals: 1 } : { homeGoals: 1, awayGoals: 1 };
  return { ...fallback, outcome, rejections: MAX_REJECTIONS };
}
