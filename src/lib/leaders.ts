// Season leaderboards. Pure -- takes raw per-match stat rows (fetched by
// the caller from player_match_stats) plus the player records they belong
// to, and aggregates everything itself (goals/assists/rating/MOTM/clean
// sheets/cards) rather than depending on players.season_* — those are a
// convenience for quick display elsewhere, this is the source of truth
// for anything that needs a full season aggregate.
//
// "League-wide or per club": there's no separate per-club API here --
// filter `rows` by clubId before calling any of the leaderboard functions
// (every row already carries it).

import type { Player, PlayerMatchStat, PlayerPosition } from '../types';

export type LeaderRow = {
  playerId: string;
  fullName: string;
  clubId: string;
  position: PlayerPosition;
  apps: number;
  minutes: number;
  goals: number;
  assists: number;
  avgRating: number;
  motm: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  goalsConceded: number;
};

export function buildLeaderRows(stats: PlayerMatchStat[], players: Player[]): LeaderRow[] {
  const playersById = new Map(players.map((p) => [p.id, p]));
  const rowsByPlayer = new Map<string, LeaderRow>();

  for (const stat of stats) {
    const player = playersById.get(stat.player_id);
    if (!player) continue;

    let row = rowsByPlayer.get(stat.player_id);
    if (!row) {
      row = {
        playerId: player.id,
        fullName: player.full_name,
        clubId: stat.club_id,
        position: player.position,
        apps: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        avgRating: 0,
        motm: 0,
        cleanSheets: 0,
        yellowCards: 0,
        redCards: 0,
        saves: 0,
        goalsConceded: 0,
      };
      rowsByPlayer.set(stat.player_id, row);
    }

    row.apps += 1;
    row.minutes += stat.minutes_played;
    row.goals += stat.goals;
    row.assists += stat.assists;
    row.motm += stat.motm ? 1 : 0;
    row.cleanSheets += stat.clean_sheet ? 1 : 0;
    row.yellowCards += stat.yellow_cards;
    row.redCards += stat.red_cards;
    row.saves += stat.saves;
    row.goalsConceded += stat.goals_conceded;
    // avgRating accumulates a running sum here, divided below once every
    // match is folded in -- cheaper than storing every rating.
    row.avgRating += stat.match_rating ?? 0;
  }

  for (const row of rowsByPlayer.values()) {
    row.avgRating = row.apps > 0 ? Math.round((row.avgRating / row.apps) * 10) / 10 : 0;
  }

  return [...rowsByPlayer.values()];
}

function topBy(rows: LeaderRow[], key: (row: LeaderRow) => number, limit: number): LeaderRow[] {
  return [...rows].sort((a, b) => key(b) - key(a)).slice(0, limit);
}

export function topScorers(rows: LeaderRow[], limit = 10): LeaderRow[] {
  return topBy(rows, (r) => r.goals, limit);
}

export function topAssisters(rows: LeaderRow[], limit = 10): LeaderRow[] {
  return topBy(rows, (r) => r.assists, limit);
}

/** Minimum 5 appearances -- guards against a one-match wonder topping the table. */
export function bestAverageRating(rows: LeaderRow[], limit = 10): LeaderRow[] {
  return topBy(
    rows.filter((r) => r.apps >= 5),
    (r) => r.avgRating,
    limit
  );
}

export function mostMotm(rows: LeaderRow[], limit = 10): LeaderRow[] {
  return topBy(rows, (r) => r.motm, limit);
}

export function mostCleanSheets(rows: LeaderRow[], limit = 10): LeaderRow[] {
  return topBy(
    rows.filter((r) => r.position === 'GK'),
    (r) => r.cleanSheets,
    limit
  );
}

export function mostCards(rows: LeaderRow[], limit = 10): LeaderRow[] {
  return topBy(rows, (r) => r.yellowCards + r.redCards, limit);
}
