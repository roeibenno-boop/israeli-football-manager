import { describe, expect, it } from 'vitest';

import { computeStandings } from './standings';
import type { Club, Fixture } from '../types';

function makeClub(id: string, name: string): Club {
  return {
    id,
    name,
    short_name: name.slice(0, 3).toUpperCase(),
    league: "Ligat ha'Al",
    budget: 0,
    logo_url: null,
    primary_colour: null,
    secondary_colour: null,
    crest_initials: null,
    current_rating: null,
  };
}

function makeFixture(
  home: Club,
  away: Club,
  homeGoals: number | null,
  awayGoals: number | null,
  status: Fixture['status'] = 'finished'
): Fixture {
  return {
    id: `${home.id}-vs-${away.id}`,
    competition: 'league',
    round: 1,
    kickoff_at: new Date().toISOString(),
    home_club_id: home.id,
    away_club_id: away.id,
    home_goals: homeGoals,
    away_goals: awayGoals,
    status,
    attendance: null,
    home_lineup_id: null,
    away_lineup_id: null,
    events: null,
  };
}

describe('computeStandings', () => {
  const a = makeClub('a', 'Alpha');
  const b = makeClub('b', 'Beta');
  const c = makeClub('c', 'Gamma');
  const clubs = [a, b, c];

  it('awards 3 points for a win, 0 for a loss', () => {
    const fixtures = [makeFixture(a, b, 2, 0)];
    const table = computeStandings(fixtures, clubs);
    const rowA = table.find((r) => r.club.id === 'a')!;
    const rowB = table.find((r) => r.club.id === 'b')!;
    expect(rowA.points).toBe(3);
    expect(rowA.won).toBe(1);
    expect(rowB.points).toBe(0);
    expect(rowB.lost).toBe(1);
  });

  it('awards 1 point each for a draw', () => {
    const fixtures = [makeFixture(a, b, 1, 1)];
    const table = computeStandings(fixtures, clubs);
    expect(table.find((r) => r.club.id === 'a')!.points).toBe(1);
    expect(table.find((r) => r.club.id === 'b')!.points).toBe(1);
    expect(table.find((r) => r.club.id === 'a')!.drawn).toBe(1);
  });

  it('ignores fixtures that have not been played yet', () => {
    const fixtures = [makeFixture(a, b, null, null, 'scheduled')];
    const table = computeStandings(fixtures, clubs);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it('computes goal difference correctly', () => {
    const fixtures = [makeFixture(a, b, 3, 1)];
    const table = computeStandings(fixtures, clubs);
    expect(table.find((r) => r.club.id === 'a')!.goalDifference).toBe(2);
    expect(table.find((r) => r.club.id === 'b')!.goalDifference).toBe(-2);
  });

  it('sorts by points, then goal difference, then goals for, then name', () => {
    // A: 1 win (3 pts, GD +2). B: 1 draw + 1 loss elsewhere isn't modeled
    // here directly -- construct a clean points-tie broken by GD instead.
    const fixtures = [
      makeFixture(a, c, 3, 1), // a: +3 pts, GD +2
      makeFixture(b, c, 4, 0), // b: +3 pts, GD +4
    ];
    const table = computeStandings(fixtures, clubs);
    expect(table[0].club.id).toBe('b'); // better GD wins the points tie
    expect(table[1].club.id).toBe('a');
  });

  it('includes every club even if it has played no fixtures', () => {
    const table = computeStandings([], clubs);
    expect(table.length).toBe(3);
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });
});
