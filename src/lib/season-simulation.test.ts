// Season-level statistical validation of the Davidson match outcome model
// (matchOdds.ts). Where matchOdds.test.ts checks the model's exact formulas
// in isolation, this file checks that those formulas behave sensibly once
// composed into a full competitive season: a double round-robin among 14
// clubs, momentum carried forward round-to-round exactly as play-match.ts's
// nextFormUpdate does it, run 200 times with different seeds.
//
// Per the spec this file implements: if any assertion here fails, report
// the actual computed number -- never loosen an assertion or touch
// matchOdds.ts's CONFIG constants to make a failure go away. The 14 club
// ratings below are this test's own fixture data (a realistic Ligat ha'Al
// spread), not part of the model -- adjusting *them* to reflect a more
// realistic distribution is fair game; adjusting CONFIG is not.

import { describe, expect, it } from 'vitest';

import { generateSeasonFixtures } from './fixtures';
import type { EffectiveRatingValue } from './lineup';
import { computeDiff, computeFormPoints, computeMomentum, sampleScoreline, type MatchResultLetter } from './matchOdds';

function rating(value: number): EffectiveRatingValue {
  return value as EffectiveRatingValue;
}

/** mulberry32, same as elsewhere in this codebase -- deterministic, seedable. */
function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// A realistic Ligat ha'Al effective-XI spread: 3 clubs clearly ahead of the
// pack, a wide mid-table cluster, and a couple of relegation-fighting sides
// -- consistent with the 55-80 range ratings.ts produces for real squads.
// Index 0 is the single strongest club, used below as "the strongest squad".
const CLUB_RATINGS = [78, 76, 74, 71, 70, 68, 67, 66, 65, 64, 63, 62, 61, 58];
const CLUB_IDS = CLUB_RATINGS.map((_, i) => `club-${i}`);
const RATING_BY_ID = new Map(CLUB_IDS.map((id, i) => [id, rating(CLUB_RATINGS[i])]));
const STRONGEST_CLUB_ID = CLUB_IDS[0];

type ClubSeasonState = {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  formString: string;
  momentum: number;
  matchesPlayed: number;
};

function freshState(): ClubSeasonState {
  return { points: 0, goalsFor: 0, goalsAgainst: 0, formString: '', momentum: 0, matchesPlayed: 0 };
}

/** Same logic as play-match.ts's nextFormUpdate, reimplemented here for module independence (established project convention). */
function nextForm(state: ClubSeasonState, result: MatchResultLetter): { formString: string; momentum: number } {
  const formString = (state.formString + result).slice(-5);
  const letters = formString.split('') as MatchResultLetter[];
  const formPoints = computeFormPoints(letters);
  const momentum = computeMomentum(formPoints, state.matchesPlayed + 1);
  return { formString, momentum };
}

type SeasonResult = {
  standings: ClubSeasonState[]; // sorted, position 0 = champion
  standingsById: Map<string, ClubSeasonState>;
  homeWins: number;
  awayWins: number;
  draws: number;
  totalMatches: number;
};

function simulateSeason(seasonIndex: number): SeasonResult {
  const rng = makeRng(10_000 + seasonIndex);
  const fixtures = generateSeasonFixtures({
    clubIds: CLUB_IDS,
    seasonStart: new Date('2026-08-01T18:00:00Z'),
  });

  const standingsById = new Map<string, ClubSeasonState>(CLUB_IDS.map((id) => [id, freshState()]));
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;

  for (const fx of fixtures) {
    const home = standingsById.get(fx.home_club_id) as ClubSeasonState;
    const away = standingsById.get(fx.away_club_id) as ClubSeasonState;
    const homeRating = RATING_BY_ID.get(fx.home_club_id) as EffectiveRatingValue;
    const awayRating = RATING_BY_ID.get(fx.away_club_id) as EffectiveRatingValue;

    const D = computeDiff(homeRating, awayRating, home.momentum, away.momentum);
    const { homeGoals, awayGoals, outcome } = sampleScoreline(D, rng);

    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (outcome === 'home') {
      home.points += 3;
      homeWins += 1;
    } else if (outcome === 'away') {
      away.points += 3;
      awayWins += 1;
    } else {
      home.points += 1;
      away.points += 1;
      draws += 1;
    }

    const homeLetter: MatchResultLetter = outcome === 'home' ? 'W' : outcome === 'away' ? 'L' : 'D';
    const awayLetter: MatchResultLetter = outcome === 'away' ? 'W' : outcome === 'home' ? 'L' : 'D';
    const homeNext = nextForm(home, homeLetter);
    const awayNext = nextForm(away, awayLetter);
    home.formString = homeNext.formString;
    home.momentum = homeNext.momentum;
    home.matchesPlayed += 1;
    away.formString = awayNext.formString;
    away.momentum = awayNext.momentum;
    away.matchesPlayed += 1;
  }

  const standings = [...standingsById.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
  });

  return { standings, standingsById, homeWins, awayWins, draws, totalMatches: fixtures.length };
}

const N_SEASONS = 200;
const seasons = Array.from({ length: N_SEASONS }, (_, i) => simulateSeason(i));

describe('season-level statistical validation (Davidson model, 200 seasons x 26 rounds)', () => {
  it("the champion's mean points land in [55, 70]", () => {
    const championPoints = seasons.map((s) => s.standings[0].points);
    const mean = championPoints.reduce((a, b) => a + b, 0) / N_SEASONS;
    // Actual number, reported unconditionally so a failure is legible:
    // eslint-disable-next-line no-console
    console.log(`[season-sim] mean champion points across ${N_SEASONS} seasons: ${mean.toFixed(2)}`);
    expect(mean).toBeGreaterThanOrEqual(55);
    expect(mean).toBeLessThanOrEqual(70);
  });

  it('the strongest squad wins the title in 45-75% of runs', () => {
    const titles = seasons.filter((s) => s.standings[0] === s.standingsById.get(STRONGEST_CLUB_ID)).length;
    const rate = titles / N_SEASONS;
    // eslint-disable-next-line no-console
    console.log(`[season-sim] strongest club title rate: ${(rate * 100).toFixed(1)}% (${titles}/${N_SEASONS})`);
    expect(rate).toBeGreaterThanOrEqual(0.45);
    expect(rate).toBeLessThanOrEqual(0.75);
  });

  it('the bottom-of-the-table club averages at least 12 points', () => {
    const bottomPoints = seasons.map((s) => s.standings[s.standings.length - 1].points);
    const mean = bottomPoints.reduce((a, b) => a + b, 0) / N_SEASONS;
    // eslint-disable-next-line no-console
    console.log(`[season-sim] mean bottom-club points across ${N_SEASONS} seasons: ${mean.toFixed(2)}`);
    expect(mean).toBeGreaterThanOrEqual(12);
  });

  it('league-wide home win rate exceeds away win rate by 10-20 percentage points', () => {
    const totalHomeWins = seasons.reduce((sum, s) => sum + s.homeWins, 0);
    const totalAwayWins = seasons.reduce((sum, s) => sum + s.awayWins, 0);
    const totalMatches = seasons.reduce((sum, s) => sum + s.totalMatches, 0);
    const homeRate = (totalHomeWins / totalMatches) * 100;
    const awayRate = (totalAwayWins / totalMatches) * 100;
    const gap = homeRate - awayRate;
    // eslint-disable-next-line no-console
    console.log(
      `[season-sim] home win rate ${homeRate.toFixed(2)}% vs away win rate ${awayRate.toFixed(2)}% (gap ${gap.toFixed(2)}pp) over ${totalMatches} matches`
    );
    expect(gap).toBeGreaterThanOrEqual(10);
    expect(gap).toBeLessThanOrEqual(20);
  });
});

describe('fatigue measurably affects match outcomes', () => {
  it('a tired XI (effectiveOverall penalty applied) underperforms the identical fresh XI against the same opponent', () => {
    const opponent = rating(70);
    const fresh = rating(70); // fatigueLevel 'fresh': no penalty (fatigue.ts's effectiveOverall)
    const tired = rating(70 - 11); // fatigueLevel 'tired': -11 penalty (fatigue.ts's effectiveOverall)

    const TRIALS = 20_000;
    const runTrials = (xiRating: EffectiveRatingValue, seed: number) => {
      const rng = makeRng(seed);
      let wins = 0;
      let points = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;
      for (let i = 0; i < TRIALS; i++) {
        // xiRating plays at home against a fixed away opponent, no momentum.
        const D = computeDiff(xiRating, opponent, 0, 0);
        const { homeGoals, awayGoals, outcome } = sampleScoreline(D, rng);
        goalsFor += homeGoals;
        goalsAgainst += awayGoals;
        if (outcome === 'home') {
          wins += 1;
          points += 3;
        } else if (outcome === 'draw') {
          points += 1;
        }
      }
      return { winRate: wins / TRIALS, pointsPerGame: points / TRIALS, avgGoalsFor: goalsFor / TRIALS, avgGoalsAgainst: goalsAgainst / TRIALS };
    };

    const freshResult = runTrials(fresh, 555);
    const tiredResult = runTrials(tired, 777);

    // eslint-disable-next-line no-console
    console.log(
      `[fatigue] fresh: winRate=${(freshResult.winRate * 100).toFixed(2)}% ppg=${freshResult.pointsPerGame.toFixed(3)} ` +
        `gf=${freshResult.avgGoalsFor.toFixed(3)} ga=${freshResult.avgGoalsAgainst.toFixed(3)}`
    );
    // eslint-disable-next-line no-console
    console.log(
      `[fatigue] tired: winRate=${(tiredResult.winRate * 100).toFixed(2)}% ppg=${tiredResult.pointsPerGame.toFixed(3)} ` +
        `gf=${tiredResult.avgGoalsFor.toFixed(3)} ga=${tiredResult.avgGoalsAgainst.toFixed(3)}`
    );

    expect(tiredResult.winRate).toBeLessThan(freshResult.winRate);
    expect(tiredResult.pointsPerGame).toBeLessThan(freshResult.pointsPerGame);
    expect(tiredResult.avgGoalsFor).toBeLessThan(freshResult.avgGoalsFor);
    expect(tiredResult.avgGoalsAgainst).toBeGreaterThan(freshResult.avgGoalsAgainst);
  });
});
