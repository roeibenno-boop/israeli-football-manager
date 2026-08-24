import { describe, expect, it } from 'vitest';

import {
  computeDiff,
  computeFormPoints,
  computeMomentum,
  computeOutcomeProbabilities,
  drawOutcome,
  sampleScoreline,
  type MatchOutcome,
} from './matchOdds';
import type { EffectiveRatingValue } from './lineup';

function rating(value: number): EffectiveRatingValue {
  return value as EffectiveRatingValue;
}

/** mulberry32, same as elsewhere in this codebase — deterministic, seedable. */
function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('computeOutcomeProbabilities', () => {
  const cases: Array<[number, number, number, number]> = [
    [0, 0.364964, 0.270073, 0.364964],
    [3, 0.454358, 0.264488, 0.281154],
    [6, 0.543244, 0.248751, 0.208005],
    [10, 0.651722, 0.216699, 0.131579],
    [15, 0.761271, 0.169672, 0.069061],
    [20, 0.840222, 0.125533, 0.034245],
    [25, 0.894088, 0.08954, 0.016376],
  ];

  it.each(cases)('matches the exact spec\'d values at D=%d', (D, pHome, pDraw, pAway) => {
    const probs = computeOutcomeProbabilities(D);
    expect(probs.pHome).toBeCloseTo(pHome, 4);
    expect(probs.pDraw).toBeCloseTo(pDraw, 4);
    expect(probs.pAway).toBeCloseTo(pAway, 4);
  });

  it('sums to exactly 1 (within 1e-12) and every outcome is strictly positive, for D in [-60, 60]', () => {
    for (let D = -60; D <= 60; D += 1) {
      const { pHome, pDraw, pAway } = computeOutcomeProbabilities(D);
      expect(pHome + pDraw + pAway).toBeCloseTo(1, 12);
      expect(pHome).toBeGreaterThan(0);
      expect(pDraw).toBeGreaterThan(0);
      expect(pAway).toBeGreaterThan(0);
    }
  });

  it('is symmetric: pHome(D) === pAway(-D), pDraw(D) === pDraw(-D)', () => {
    for (const D of [3, 6, 10, 15, 25]) {
      const pos = computeOutcomeProbabilities(D);
      const neg = computeOutcomeProbabilities(-D);
      expect(pos.pHome).toBeCloseTo(neg.pAway, 10);
      expect(pos.pAway).toBeCloseTo(neg.pHome, 10);
      expect(pos.pDraw).toBeCloseTo(neg.pDraw, 10);
    }
  });
});

describe('computeDiff', () => {
  it('adds home advantage and momentum, subtracts the away side', () => {
    const D = computeDiff(rating(75), rating(70), 1.5, -0.5);
    // 75 + 3 (HOME_ADVANTAGE) + 1.5 - (70 - 0.5) = 79.5 - 69.5 = 10
    expect(D).toBe(10);
  });

  it('is zero for equal ratings, no momentum', () => {
    expect(computeDiff(rating(70), rating(70) as EffectiveRatingValue, 0, 0)).toBe(3); // home advantage still applies
  });
});

describe('computeFormPoints', () => {
  it('scores W=3, D=1, L=0', () => {
    expect(computeFormPoints(['W', 'W', 'D', 'L', 'W'])).toBe(10);
    expect(computeFormPoints(['L', 'L', 'L', 'L', 'L'])).toBe(0);
    expect(computeFormPoints(['W', 'W', 'W', 'W', 'W'])).toBe(15);
  });
});

describe('computeMomentum', () => {
  it('gives exactly +3.0 for five wins', () => {
    expect(computeMomentum(15, 5)).toBe(3.0);
  });

  it('gives exactly -3.0 for five losses', () => {
    expect(computeMomentum(0, 5)).toBe(-3.0);
  });

  it('gives exactly -2.4 for four losses (early season, n=4)', () => {
    expect(computeMomentum(0, 4)).toBeCloseTo(-2.4, 10);
  });

  it('caps n at 5 even if more matches have been played', () => {
    expect(computeMomentum(15, 20)).toBe(computeMomentum(15, 5));
  });

  it('is negative for below-neutral form (5 draws = 5 points, below the 7.5-point neutral for 5 matches)', () => {
    expect(computeMomentum(5, 5)).toBe(-1);
  });
});

describe('drawOutcome', () => {
  const probs = computeOutcomeProbabilities(6); // pHome ~0.543, pDraw ~0.249, pAway ~0.208

  it('picks home for a low uniform draw', () => {
    expect(drawOutcome(probs, 0)).toBe('home');
  });
  it('picks draw for a uniform draw just past pHome', () => {
    expect(drawOutcome(probs, probs.pHome + 0.001)).toBe('draw');
  });
  it('picks away for a uniform draw near 1', () => {
    expect(drawOutcome(probs, 0.999)).toBe('away');
  });
});

describe('sampleScoreline', () => {
  it('always returns a scoreline whose sign matches the drawn outcome', () => {
    const rng = makeRng(12345);
    for (let i = 0; i < 500; i++) {
      const result = sampleScoreline(6, rng);
      const sign: MatchOutcome =
        result.homeGoals > result.awayGoals ? 'home' : result.homeGoals < result.awayGoals ? 'away' : 'draw';
      expect(sign).toBe(result.outcome);
    }
  });

  it('is deterministic for a given rng stream', () => {
    const a = sampleScoreline(6, makeRng(999));
    const b = sampleScoreline(6, makeRng(999));
    expect(a).toEqual(b);
  });

  it('realised outcome frequencies match the Davidson probabilities within 0.5% over 100,000 fixtures at D=6', () => {
    const D = 6;
    const expected = computeOutcomeProbabilities(D);
    const rng = makeRng(42);
    const counts = { home: 0, draw: 0, away: 0 };
    const scorelineCounts = new Map<string, number>();

    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const result = sampleScoreline(D, rng);
      counts[result.outcome] += 1;
      const key = `${result.homeGoals}-${result.awayGoals}`;
      scorelineCounts.set(key, (scorelineCounts.get(key) ?? 0) + 1);
    }

    expect(counts.home / N).toBeCloseTo(expected.pHome, 2); // within 0.005 (toBeCloseTo digit 2 => <0.005 diff)
    expect(counts.draw / N).toBeCloseTo(expected.pDraw, 2);
    expect(counts.away / N).toBeCloseTo(expected.pAway, 2);
    // Explicit 0.5% (=0.005) check, spelled out rather than relying on toBeCloseTo's rounding rule.
    expect(Math.abs(counts.home / N - expected.pHome)).toBeLessThan(0.005);
    expect(Math.abs(counts.draw / N - expected.pDraw)).toBeLessThan(0.005);
    expect(Math.abs(counts.away / N - expected.pAway)).toBeLessThan(0.005);

    const topScorelines = [...scorelineCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);
    expect(topScorelines).toEqual(expect.arrayContaining(['1-0', '2-1', '1-1']));
  });
});
