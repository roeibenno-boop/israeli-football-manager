import { describe, expect, it } from 'vitest';

import {
  accumulateFatigue,
  effectiveOverall,
  fatigueLevelForPoints,
  injuryRiskForLevel,
  recoverFatigue,
  rollInjury,
} from './fatigue';

describe('fatigueLevelForPoints', () => {
  it('classifies the three bands correctly', () => {
    expect(fatigueLevelForPoints(0)).toBe('fresh');
    expect(fatigueLevelForPoints(33)).toBe('fresh');
    expect(fatigueLevelForPoints(34)).toBe('moderate');
    expect(fatigueLevelForPoints(66)).toBe('moderate');
    expect(fatigueLevelForPoints(67)).toBe('tired');
    expect(fatigueLevelForPoints(100)).toBe('tired');
  });
});

describe('accumulateFatigue', () => {
  it('moves a fresh player to moderate after a full 90 minutes', () => {
    const points = accumulateFatigue(0, 90, 27);
    expect(fatigueLevelForPoints(points)).toBe('moderate');
  });

  it('two full matches in a row push a fresh player to tired', () => {
    const afterOne = accumulateFatigue(0, 90, 27);
    const afterTwo = accumulateFatigue(afterOne, 90, 27);
    expect(fatigueLevelForPoints(afterTwo)).toBe('tired');
  });

  it('scales gain by minutes played', () => {
    const full = accumulateFatigue(0, 90, 27);
    const half = accumulateFatigue(0, 45, 27);
    expect(half).toBeCloseTo(full / 2, 5);
  });

  it('applies a bigger gain for older players and a smaller one for younger players', () => {
    const prime = accumulateFatigue(0, 90, 27);
    const veteran = accumulateFatigue(0, 90, 33);
    const youth = accumulateFatigue(0, 90, 20);
    expect(veteran).toBeGreaterThan(prime);
    expect(youth).toBeLessThan(prime);
  });

  it('clamps at 100', () => {
    expect(accumulateFatigue(95, 90, 33)).toBe(100);
  });
});

describe('recoverFatigue', () => {
  it('brings a moderate player back to fresh within 4-5 rest days', () => {
    const moderatePoints = accumulateFatigue(0, 90, 27); // ~40
    const afterRest = recoverFatigue(moderatePoints, 5, 27);
    expect(fatigueLevelForPoints(afterRest)).toBe('fresh');
  });

  it('older players recover slower than younger players given the same rest', () => {
    const start = 60;
    const veteran = recoverFatigue(start, 3, 33);
    const prime = recoverFatigue(start, 3, 27);
    const youth = recoverFatigue(start, 3, 20);
    expect(veteran).toBeGreaterThan(prime); // recovered less -> more points remaining
    expect(youth).toBeLessThan(prime); // recovered more -> fewer points remaining
  });

  it('clamps at 0', () => {
    expect(recoverFatigue(10, 10, 27)).toBe(0);
  });
});

describe('effectiveOverall', () => {
  it('applies no penalty when fresh', () => {
    expect(effectiveOverall(72, 'fresh')).toBe(72);
  });

  it('applies -4 when moderate', () => {
    expect(effectiveOverall(72, 'moderate')).toBe(68);
  });

  it('applies -11 when tired', () => {
    expect(effectiveOverall(72, 'tired')).toBe(61);
  });

  it('floors at 40 even for a low true overall', () => {
    expect(effectiveOverall(45, 'tired')).toBe(40);
  });
});

describe('injuryRiskForLevel', () => {
  it('increases with fatigue', () => {
    expect(injuryRiskForLevel('fresh')).toBe(0.01);
    expect(injuryRiskForLevel('moderate')).toBe(0.03);
    expect(injuryRiskForLevel('tired')).toBe(0.08);
  });
});

describe('rollInjury', () => {
  it('is deterministic for a given rng sequence', () => {
    const sequence = [0.5, 0.5];
    let i = 0;
    const rng = () => sequence[i++];
    const a = rollInjury('tired', () => sequence[0]);
    i = 0;
    const b = rollInjury('tired', () => sequence[0]);
    expect(a).toBe(b);
  });

  it('never injures when the roll exceeds the risk', () => {
    expect(rollInjury('fresh', () => 0.5)).toBeNull();
  });

  it('injures for 1-4 weeks when the roll is within risk', () => {
    const weeks = rollInjury('tired', () => 0.001);
    expect(weeks).not.toBeNull();
    expect(weeks).toBeGreaterThanOrEqual(1);
    expect(weeks).toBeLessThanOrEqual(4);
  });
});
