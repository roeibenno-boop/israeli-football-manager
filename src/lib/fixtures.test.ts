import { describe, expect, it } from 'vitest';

import { generateSeasonFixtures } from './fixtures';

const CLUB_IDS = Array.from({ length: 14 }, (_, i) => `club-${i}`);
const SEASON_START = new Date('2026-08-28T18:00:00Z');

describe('generateSeasonFixtures', () => {
  it('produces the full double round-robin size: n * (n-1) fixtures', () => {
    const fixtures = generateSeasonFixtures({ clubIds: CLUB_IDS, seasonStart: SEASON_START });
    expect(fixtures.length).toBe(14 * 13); // 182
  });

  it('has exactly n-1 rounds x 2 (home + away halves), 7 matches each', () => {
    const fixtures = generateSeasonFixtures({ clubIds: CLUB_IDS, seasonStart: SEASON_START });
    const rounds = new Map<number, number>();
    for (const f of fixtures) rounds.set(f.round, (rounds.get(f.round) ?? 0) + 1);
    expect(rounds.size).toBe(26);
    for (const count of rounds.values()) expect(count).toBe(7);
  });

  it('every club plays every other club exactly once at home and once away', () => {
    const fixtures = generateSeasonFixtures({ clubIds: CLUB_IDS, seasonStart: SEASON_START });
    const homeAway = new Map<string, Set<string>>();
    for (const id of CLUB_IDS) homeAway.set(id, new Set());

    for (const f of fixtures) {
      // No club plays itself.
      expect(f.home_club_id).not.toBe(f.away_club_id);
      homeAway.get(f.home_club_id)!.add(`home:${f.away_club_id}`);
    }

    for (const id of CLUB_IDS) {
      const opponents = homeAway.get(id)!;
      const others = CLUB_IDS.filter((o) => o !== id);
      for (const opp of others) {
        expect(opponents.has(`home:${opp}`)).toBe(true);
      }
      expect(opponents.size).toBe(13);
    }
  });

  it('every club plays exactly once per round', () => {
    const fixtures = generateSeasonFixtures({ clubIds: CLUB_IDS, seasonStart: SEASON_START });
    const byRound = new Map<number, string[]>();
    for (const f of fixtures) {
      const list = byRound.get(f.round) ?? [];
      list.push(f.home_club_id, f.away_club_id);
      byRound.set(f.round, list);
    }
    for (const [, clubsInRound] of byRound) {
      expect(new Set(clubsInRound).size).toBe(14);
      expect(clubsInRound.length).toBe(14);
    }
  });

  it('spaces rounds by daysBetweenRounds and starts at seasonStart', () => {
    const fixtures = generateSeasonFixtures({ clubIds: CLUB_IDS, seasonStart: SEASON_START, daysBetweenRounds: 7 });
    const round1 = fixtures.find((f) => f.round === 1)!;
    const round2 = fixtures.find((f) => f.round === 2)!;
    expect(new Date(round1.kickoff_at).toISOString()).toBe(SEASON_START.toISOString());
    const diffDays =
      (new Date(round2.kickoff_at).getTime() - new Date(round1.kickoff_at).getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });

  it('throws on an odd number of teams', () => {
    expect(() => generateSeasonFixtures({ clubIds: CLUB_IDS.slice(0, 13), seasonStart: SEASON_START })).toThrow();
  });
});
