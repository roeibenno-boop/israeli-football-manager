// League table computation. Pure function over fixtures + clubs.
//
// Tiebreakers: points, then goal difference, then goals for, then name
// (alphabetical, just for a stable/deterministic final order). This is a
// simplified tiebreaker chain -- no head-to-head sub-table, which real
// league regulations often use before goal difference. Noted as a
// simplification rather than implemented, given the scope here.

import type { Club, Fixture } from '../types';

export type StandingsRow = {
  club: Club;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export function computeStandings(fixtures: Fixture[], clubs: Club[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const club of clubs) {
    rows.set(club.id, {
      club,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  const finished = fixtures.filter(
    (f) => f.status === 'finished' && f.home_goals != null && f.away_goals != null
  );

  for (const fixture of finished) {
    const home = rows.get(fixture.home_club_id);
    const away = rows.get(fixture.away_club_id);
    if (!home || !away) continue; // fixture references a club not in `clubs` -- skip rather than crash

    const homeGoals = fixture.home_goals as number;
    const awayGoals = fixture.away_goals as number;

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (homeGoals < awayGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.club.name.localeCompare(b.club.name);
  });
}
