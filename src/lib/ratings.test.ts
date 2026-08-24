import { describe, expect, it } from 'vitest';

import { computeClubRating, computeOverall, computePotential, deriveAttributes } from './ratings';

describe('computeOverall', () => {
  it('applies the young-player penalty below age 21', () => {
    const young = computeOverall(2_000_000, 20, 'MF');
    const prime = computeOverall(2_000_000, 21, 'MF');
    expect(young).toBe(prime - 2);
  });

  it('applies no adjustment across the 21-32 prime range', () => {
    const at21 = computeOverall(2_000_000, 21, 'MF');
    const at32 = computeOverall(2_000_000, 32, 'MF');
    expect(at21).toBe(at32);
  });

  it('applies the veteran bonus above age 32', () => {
    const prime = computeOverall(2_000_000, 32, 'MF');
    const veteran = computeOverall(2_000_000, 33, 'MF');
    expect(veteran).toBe(prime + 3);
  });

  it('clamps to a floor of 45 for a worthless player', () => {
    expect(computeOverall(0, 25, 'FW')).toBe(45);
    expect(computeOverall(100, 25, 'FW')).toBeGreaterThanOrEqual(45);
  });

  it('clamps to a ceiling of 88 for an extremely valuable player', () => {
    expect(computeOverall(500_000_000, 25, 'FW')).toBe(88);
  });

  it('always returns an integer', () => {
    expect(Number.isInteger(computeOverall(1_234_567, 24, 'DF'))).toBe(true);
  });

  it('is deterministic', () => {
    expect(computeOverall(3_000_000, 27, 'GK')).toBe(computeOverall(3_000_000, 27, 'GK'));
  });
});

describe('computePotential', () => {
  it('gives the largest bump to players 19 and under', () => {
    const potential = computePotential(60, 19);
    expect(potential - 60).toBeGreaterThanOrEqual(6);
    expect(potential - 60).toBeLessThanOrEqual(12);
  });

  it('gives a smaller bump at the 20-23 bracket', () => {
    const potential = computePotential(60, 20);
    expect(potential - 60).toBeGreaterThanOrEqual(3);
    expect(potential - 60).toBeLessThanOrEqual(7);
  });

  it('gives a small bump at the 24-27 bracket', () => {
    const potential = computePotential(60, 24);
    expect(potential - 60).toBeGreaterThanOrEqual(0);
    expect(potential - 60).toBeLessThanOrEqual(3);
  });

  it('gives no bump at 28 and over', () => {
    expect(computePotential(60, 28)).toBe(60);
    expect(computePotential(60, 40)).toBe(60);
  });

  it('never returns less than overall', () => {
    expect(computePotential(60, 28)).toBeGreaterThanOrEqual(60);
  });

  it('clamps to a ceiling of 92 even for a young, already-elite player', () => {
    expect(computePotential(88, 17)).toBeLessThanOrEqual(92);
  });

  it('is deterministic', () => {
    expect(computePotential(65, 19)).toBe(computePotential(65, 19));
  });
});

describe('deriveAttributes', () => {
  it('is deterministic for the same player id', () => {
    const a = deriveAttributes(70, 'MF', 'player-1');
    const b = deriveAttributes(70, 'MF', 'player-1');
    expect(a).toEqual(b);
  });

  it('varies with player id', () => {
    const a = deriveAttributes(70, 'MF', 'player-1');
    const b = deriveAttributes(70, 'MF', 'player-2');
    expect(a).not.toEqual(b);
  });

  it('rates a forward higher on shooting than a goalkeeper with the same overall and id', () => {
    // Same seed (player id) for both, so the per-attribute variance term is
    // identical -- the difference below is purely the position weight gap
    // (FW +12 vs GK -25 => 37) and is exact, not just directionally true.
    const gk = deriveAttributes(60, 'GK', 'shared-seed');
    const fw = deriveAttributes(60, 'FW', 'shared-seed');
    expect(fw.shooting - gk.shooting).toBe(37);
  });

  it('rates a defender higher on defending than a forward with the same overall and id', () => {
    const df = deriveAttributes(60, 'DF', 'shared-seed-2');
    const fw = deriveAttributes(60, 'FW', 'shared-seed-2');
    expect(df.defending).toBeGreaterThan(fw.defending);
  });

  it('clamps every attribute to [30, 95] even at extreme overalls', () => {
    const low = deriveAttributes(45, 'GK', 'floor-test');
    const high = deriveAttributes(88, 'FW', 'ceiling-test');
    for (const value of Object.values(low)) {
      expect(value).toBeGreaterThanOrEqual(30);
    }
    for (const value of Object.values(high)) {
      expect(value).toBeLessThanOrEqual(95);
    }
  });

  it('returns all six attribute keys', () => {
    const attrs = deriveAttributes(70, 'FW', 'key-check');
    expect(Object.keys(attrs).sort()).toEqual(
      ['defending', 'dribbling', 'passing', 'pace', 'physical', 'shooting'].sort()
    );
  });
});

describe('computeClubRating', () => {
  it('weights GK/DF/MF/FW group averages as 15/30/30/25', () => {
    const squad = [
      { position: 'GK' as const, overall: 70 },
      { position: 'DF' as const, overall: 60 },
      { position: 'DF' as const, overall: 60 },
      { position: 'DF' as const, overall: 60 },
      { position: 'DF' as const, overall: 60 },
      { position: 'MF' as const, overall: 65 },
      { position: 'MF' as const, overall: 65 },
      { position: 'MF' as const, overall: 65 },
      { position: 'MF' as const, overall: 65 },
      { position: 'FW' as const, overall: 75 },
      { position: 'FW' as const, overall: 75 },
    ];
    // Exactly 11 players -> the whole squad is the best XI, no ambiguity.
    const rating = computeClubRating(squad);
    expect(rating.defence).toBe(60);
    expect(rating.midfield).toBe(65);
    expect(rating.attack).toBe(75);
    // 70*0.15 + 60*0.30 + 65*0.30 + 75*0.25 = 66.75 -> rounds to 67.
    expect(rating.overall).toBe(67);
  });

  it('only considers the best 11 by overall', () => {
    const strongXI = Array.from({ length: 11 }, () => ({ position: 'MF' as const, overall: 80 }));
    const weakBench = Array.from({ length: 5 }, () => ({ position: 'FW' as const, overall: 40 }));
    const rating = computeClubRating([...strongXI, ...weakBench]);
    // The weak bench FWs shouldn't be in the XI, so attack (no FW in XI) is 0,
    // not dragged toward 40.
    expect(rating.attack).toBe(0);
    expect(rating.midfield).toBe(80);
  });

  it('does not throw on an empty squad', () => {
    expect(computeClubRating([])).toEqual({ overall: 0, attack: 0, midfield: 0, defence: 0 });
  });
});
