import { describe, expect, it } from 'vitest';

import { pickManOfTheMatch, rateGoalkeeper, rateOutfieldPlayer, type OutfieldMatchStats } from './matchRating';

function baseStats(overrides: Partial<OutfieldMatchStats> = {}): OutfieldMatchStats {
  return {
    position: 'MF',
    started: true,
    minutesPlayed: 90,
    goals: 0,
    assists: 0,
    shotsOnTarget: 0,
    shotsOffTarget: 0,
    keyPasses: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    tackles: 0,
    interceptions: 0,
    duelsWon: 0,
    duelsLost: 0,
    cleanSheet: false,
    goalsConceded: 0,
    yellowCards: 0,
    redCards: 0,
    ownGoals: 0,
    penaltiesMissed: 0,
    ...overrides,
  };
}

describe('rateOutfieldPlayer', () => {
  it('starts from a 6.0 baseline for a blank stat line', () => {
    expect(rateOutfieldPlayer(baseStats())).toBe(6.0);
  });

  it('gives a bigger goal bonus to a defender than a forward', () => {
    const dfGoal = rateOutfieldPlayer(baseStats({ position: 'DF', goals: 1 }));
    const fwGoal = rateOutfieldPlayer(baseStats({ position: 'FW', goals: 1 }));
    expect(dfGoal).toBeGreaterThan(fwGoal);
    expect(dfGoal).toBeCloseTo(7.5, 5);
    expect(fwGoal).toBeCloseTo(7.0, 5);
  });

  it('rewards a high pass completion rate and punishes a low one', () => {
    const good = rateOutfieldPlayer(baseStats({ passesAttempted: 100, passesCompleted: 90 }));
    const bad = rateOutfieldPlayer(baseStats({ passesAttempted: 100, passesCompleted: 50 }));
    expect(good).toBeCloseTo(6.3, 5);
    expect(bad).toBeCloseTo(5.7, 5);
  });

  it('only penalizes goals conceded for defenders', () => {
    const df = rateOutfieldPlayer(baseStats({ position: 'DF', goalsConceded: 2 }));
    const mf = rateOutfieldPlayer(baseStats({ position: 'MF', goalsConceded: 2 }));
    expect(df).toBeLessThan(6.0);
    expect(mf).toBe(6.0);
  });

  it('applies card and own-goal penalties', () => {
    expect(rateOutfieldPlayer(baseStats({ yellowCards: 1 }))).toBeCloseTo(5.7, 5);
    expect(rateOutfieldPlayer(baseStats({ redCards: 1 }))).toBeCloseTo(4.5, 5);
    expect(rateOutfieldPlayer(baseStats({ ownGoals: 1 }))).toBeCloseTo(4.8, 5);
  });

  it('pulls a brief substitute appearance back toward 6.0', () => {
    const wouldBeGreat = rateOutfieldPlayer(baseStats({ position: 'FW', goals: 2, started: true }));
    const briefSub = rateOutfieldPlayer(baseStats({ position: 'FW', goals: 2, started: false, minutesPlayed: 10 }));
    expect(briefSub).toBeLessThan(wouldBeGreat);
    expect(briefSub).toBeGreaterThan(6.0);
  });

  it('clamps to [1, 10]', () => {
    expect(rateOutfieldPlayer(baseStats({ redCards: 5, ownGoals: 5 }))).toBe(1.0);
    expect(rateOutfieldPlayer(baseStats({ position: 'DF', goals: 10 }))).toBe(10.0);
  });
});

describe('rateGoalkeeper', () => {
  it('starts from a 6.0 baseline', () => {
    expect(rateGoalkeeper({ started: true, minutesPlayed: 90, saves: 0, cleanSheet: false, goalsConceded: 0 })).toBe(
      6.0
    );
  });

  it('rewards saves and a clean sheet, punishes goals conceded', () => {
    const busy = rateGoalkeeper({ started: true, minutesPlayed: 90, saves: 6, cleanSheet: true, goalsConceded: 0 });
    expect(busy).toBeCloseTo(8.5, 5);
    const leaky = rateGoalkeeper({ started: true, minutesPlayed: 90, saves: 1, cleanSheet: false, goalsConceded: 4 });
    // Raw: 6.0 + 1*0.25 - 4*0.4 = 4.65 exactly -- but that's a .x5 rounding
    // boundary, and IEEE754 float representation lands it fractionally
    // above 46.5 before the *10/round(...)/10, so it rounds up to 4.7.
    expect(leaky).toBeCloseTo(4.7, 5);
  });
});

describe('pickManOfTheMatch', () => {
  it('picks the highest rating', () => {
    const winner = pickManOfTheMatch([
      { playerId: 'a', rating: 7.5, goals: 0, assists: 0 },
      { playerId: 'b', rating: 8.9, goals: 1, assists: 0 },
    ]);
    expect(winner).toBe('b');
  });

  it('breaks a rating tie by goals, then assists', () => {
    const byGoals = pickManOfTheMatch([
      { playerId: 'a', rating: 8.0, goals: 1, assists: 0 },
      { playerId: 'b', rating: 8.0, goals: 2, assists: 0 },
    ]);
    expect(byGoals).toBe('b');

    const byAssists = pickManOfTheMatch([
      { playerId: 'a', rating: 8.0, goals: 1, assists: 0 },
      { playerId: 'b', rating: 8.0, goals: 1, assists: 2 },
    ]);
    expect(byAssists).toBe('b');
  });

  it('returns null for an empty list', () => {
    expect(pickManOfTheMatch([])).toBeNull();
  });
});
