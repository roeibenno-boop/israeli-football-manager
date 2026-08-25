import { describe, expect, it } from 'vitest';

import { adjustedOverall, autoPickRotationXI, computeClubRating, positionPenalty, type StartingXIEntry } from './lineup';
import type { FatigueLevel, Player, PlayerPosition } from '../types';

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

describe('autoPickRotationXI', () => {
  // A comfortably-sized 4-3-3-worth squad: 3 GK, 6 DF, 5 MF, 5 FW.
  function makeSquad(fatigueFor: (position: PlayerPosition, index: number) => FatigueLevel): Player[] {
    const counts: Record<PlayerPosition, number> = { GK: 3, DF: 6, MF: 5, FW: 5 };
    const players: Player[] = [];
    (Object.keys(counts) as PlayerPosition[]).forEach((position) => {
      for (let i = 0; i < counts[position]; i++) {
        players.push(
          makePlayer({
            id: `${position}-${i}`,
            position,
            overall: 70,
            fatigue_level: fatigueFor(position, i),
          })
        );
      }
    });
    return players;
  }

  it('excludes tired players and fills the XI cleanly, no warning, when enough non-tired players exist', () => {
    const squad = makeSquad((_, i) => (i === 0 ? 'tired' : 'fresh')); // one tired player per group, plenty fresh left
    const result = autoPickRotationXI(squad, '4-3-3');

    expect(result.warning).toBeNull();
    const usedIds = Object.values(result.assignment).filter((id): id is string => id != null);
    expect(usedIds).toHaveLength(11);
    for (const id of usedIds) {
      const player = squad.find((p) => p.id === id)!;
      expect(player.fatigue_level).not.toBe('tired');
    }
  });

  it('falls back to the freshest available and warns when there are not enough non-tired players', () => {
    // Every outfield player tired except a bare handful -- not enough
    // non-tired DF/MF/FW to fill 4-3-3 without dipping into the tired pool.
    const squad = makeSquad((position, i) => {
      if (position === 'GK') return 'fresh';
      return i === 0 ? 'moderate' : 'tired';
    });
    const result = autoPickRotationXI(squad, '4-3-3');

    expect(result.warning).not.toBeNull();
    expect(result.warning).toMatch(/freshest players still available/);
    const usedIds = Object.values(result.assignment).filter((id): id is string => id != null);
    expect(usedIds).toHaveLength(11); // still fills the XI rather than leaving gaps
  });

  it('is deterministic -- same squad, same result', () => {
    const squad = makeSquad((_, i) => (i === 0 ? 'tired' : 'fresh'));
    const a = autoPickRotationXI(squad, '4-3-3');
    const b = autoPickRotationXI(squad, '4-3-3');
    expect(a).toEqual(b);
  });
});
