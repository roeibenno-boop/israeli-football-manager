// Round-robin season generator. Pure function -- produces fixture rows,
// doesn't write them anywhere (see scripts/generate-fixtures.ts for that).
//
// Uses the standard "circle method": fix one team, rotate the rest through
// n-1 rounds so every team plays every other exactly once, then repeat
// with home/away swapped for the second half of the season. Requires an
// even number of teams (true for our 14 clubs) -- odd counts would need a
// "bye" each round, not implemented here.

export type GeneratedFixture = {
  competition: 'league';
  round: number;
  kickoff_at: string; // ISO timestamp
  home_club_id: string;
  away_club_id: string;
  status: 'scheduled';
};

function circleMethodRounds(teamIds: string[]): Array<Array<[string, string]>> {
  const n = teamIds.length;
  if (n < 2 || n % 2 !== 0) {
    throw new Error(`circleMethodRounds requires an even number of teams (got ${n})`);
  }

  const arr = [...teamIds];
  const rounds: Array<Array<[string, string]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // Alternate which side of the pair is "home" per round so home games
      // are reasonably balanced across this half of the season.
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop() as string);
  }

  return rounds;
}

export type GenerateSeasonOptions = {
  clubIds: string[];
  /** First round's kickoff date/time. Subsequent rounds are one week later each. */
  seasonStart: Date;
  /** Days between rounds. Default 7. */
  daysBetweenRounds?: number;
};

/**
 * Full double round-robin: every club plays every other club twice (once
 * home, once away). For 14 clubs that's 13 rounds x 2 = 26 rounds,
 * 7 matches/round, 182 fixtures total.
 */
export function generateSeasonFixtures({
  clubIds,
  seasonStart,
  daysBetweenRounds = 7,
}: GenerateSeasonOptions): GeneratedFixture[] {
  const firstHalf = circleMethodRounds(clubIds);
  const secondHalf = firstHalf.map((pairs) => pairs.map(([home, away]) => [away, home] as [string, string]));
  const allRounds = [...firstHalf, ...secondHalf];

  const fixtures: GeneratedFixture[] = [];
  allRounds.forEach((pairs, roundIndex) => {
    const kickoff = new Date(seasonStart);
    kickoff.setDate(kickoff.getDate() + roundIndex * daysBetweenRounds);

    pairs.forEach(([homeClubId, awayClubId]) => {
      fixtures.push({
        competition: 'league',
        round: roundIndex + 1,
        kickoff_at: kickoff.toISOString(),
        home_club_id: homeClubId,
        away_club_id: awayClubId,
        status: 'scheduled',
      });
    });
  });

  return fixtures;
}
