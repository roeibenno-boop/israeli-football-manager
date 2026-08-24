import { describe, expect, it } from 'vitest';

import { adjustedOverall, computeClubRating, positionPenalty, type StartingXIEntry } from './lineup';
import type { Player } from '../types';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    club_id: 'c1',
    full_name: 'Test Player',
    position: 'MF',
    birth_date: null,
    age: 25,
    market_value: 1_000_000,
    weekly_wage: 0,
    contract_until: null,
    nationality: 'Israel',
    overall: 70,
    potential: null,
    pace: null,
    shooting: null,
    passing: null,
    dribbling: null,
    defending: null,
    physical: null,
    preferred_foot: null,
    height_cm: null,
    fatigue_level: 'fresh',
    fatigue_points: 0,
    form: null,
    injured_until: null,
    suspended_matches: 0,
    season_goals: 0,
    season_assists: 0,
    season_apps: 0,
    season_minutes: 0,
    ...overrides,
  };
}

describe('positionPenalty', () => {
  it('is 0 for the same group', () => {
    expect(positionPenalty('DF', 'DF')).toBe(0);
  });
  it('is -5 one group away', () => {
    expect(positionPenalty('DF', 'MF')).toBe(-5);
    expect(positionPenalty('MF', 'FW')).toBe(-5);
  });
  it('is -10 two or more groups away', () => {
    expect(positionPenalty('DF', 'FW')).toBe(-10);
    expect(positionPenalty('GK', 'FW')).toBe(-10);
  });
});

describe('adjustedOverall', () => {
  it('applies only the position penalty when fresh', () => {
    const player = makePlayer({ overall: 70, position: 'DF', fatigue_level: 'fresh' });
    expect(adjustedOverall(player, 'MF')).toBe(65); // 70 - 5
  });

  it('stacks the fatigue penalty and the position penalty', () => {
    const player = makePlayer({ overall: 70, position: 'DF', fatigue_level: 'tired' });
    // effectiveOverall(70, 'tired') = 59, then -5 for one group away (MF) = 54.
    expect(adjustedOverall(player, 'MF')).toBe(54);
  });
});

function xiEntry(overrides: Partial<Player> & { slotGroup: StartingXIEntry['slotGroup'] }): StartingXIEntry {
  const { slotGroup, ...playerOverrides } = overrides;
  return { slotGroup, player: makePlayer(playerOverrides) };
}

describe('computeClubRating', () => {
  it('throws unless given exactly 11 players', () => {
    expect(() => computeClubRating([xiEntry({ slotGroup: 'GK' })])).toThrow();
  });

  it('weights GK/DF/MF/FW group averages as 15/30/30/25 using effective overalls', () => {
    const xi: StartingXIEntry[] = [
      xiEntry({ slotGroup: 'GK', position: 'GK', overall: 70, fatigue_level: 'fresh' }),
      ...Array.from({ length: 4 }, () => xiEntry({ slotGroup: 'DF', position: 'DF', overall: 60, fatigue_level: 'fresh' })),
      ...Array.from({ length: 4 }, () => xiEntry({ slotGroup: 'MF', position: 'MF', overall: 65, fatigue_level: 'fresh' })),
      ...Array.from({ length: 2 }, () => xiEntry({ slotGroup: 'FW', position: 'FW', overall: 75, fatigue_level: 'fresh' })),
    ];
    const rating = computeClubRating(xi);
    expect(rating.defence).toBe(60);
    expect(rating.midfield).toBe(65);
    expect(rating.attack).toBe(75);
    // 70*0.15 + 60*0.30 + 65*0.30 + 75*0.25 = 66.75 -> rounds to 67.
    expect(rating.overall).toBe(67);
  });

  it('drags the rating down when a fatigued player is in the XI', () => {
    const freshXI: StartingXIEntry[] = [
      xiEntry({ slotGroup: 'GK', position: 'GK', overall: 70, fatigue_level: 'fresh' }),
      ...Array.from({ length: 4 }, () => xiEntry({ slotGroup: 'DF', position: 'DF', overall: 70, fatigue_level: 'fresh' })),
      ...Array.from({ length: 3 }, () => xiEntry({ slotGroup: 'MF', position: 'MF', overall: 70, fatigue_level: 'fresh' })),
      ...Array.from({ length: 3 }, () => xiEntry({ slotGroup: 'FW', position: 'FW', overall: 70, fatigue_level: 'fresh' })),
    ];
    const tiredXI = freshXI.map((entry, i) =>
      i === 0 ? { ...entry, player: { ...entry.player, fatigue_level: 'tired' as const } } : entry
    );
    expect(computeClubRating(tiredXI).overall).toBeLessThan(computeClubRating(freshXI).overall);
  });

  it('reflects an out-of-position player via a lower group average', () => {
    const base: StartingXIEntry[] = [
      xiEntry({ slotGroup: 'GK', position: 'GK', overall: 70 }),
      ...Array.from({ length: 4 }, () => xiEntry({ slotGroup: 'DF', position: 'DF', overall: 70 })),
      ...Array.from({ length: 3 }, () => xiEntry({ slotGroup: 'MF', position: 'MF', overall: 70 })),
      xiEntry({ slotGroup: 'FW', position: 'FW', overall: 70 }),
      xiEntry({ slotGroup: 'FW', position: 'FW', overall: 70 }),
      xiEntry({ slotGroup: 'FW', position: 'MF', overall: 70 }), // a midfielder played out of position at FW
    ];
    // 70, 70, 70-5(adjacent) = 65 -> average 68.33 -> rounds to 68.
    expect(computeClubRating(base).attack).toBe(68);
  });
});
