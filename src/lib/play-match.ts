// Orchestrates one fixture end to end: runs the match engine, rates every
// player, picks MOTM, and works out the condition/season-stat updates for
// every player involved (not just the 22 who played — everyone on both
// full squads either accumulates fatigue or recovers it). Pure — takes
// plain data in, returns plain data out. The actual Supabase reads/writes
// live in app/(tabs)/fixtures.tsx, same split as everywhere else in this
// project (screens own I/O, src/lib/ owns logic).
//
// Honest limitation: this does NOT run as a single database transaction.
// Supabase's client REST API has no cross-table client transaction
// primitive — true atomicity here would need a Postgres function (RPC),
// which would mean re-implementing this whole module in plpgsql. Out of
// scope for this pass; the caller writes sequentially and surfaces
// whatever succeeded/failed rather than silently claiming atomicity it
// doesn't have.

import { accumulateFatigue, effectiveOverall, fatigueLevelForPoints, recoverFatigue, rollInjury, type FatigueLevel } from './fatigue';
import type { FormationKey } from './formations';
import { computeClubRating, startingXIFrom, type SlotAssignment } from './lineup';
import { computeFormPoints, computeMomentum, type MatchResultLetter } from './matchOdds';
import { pickManOfTheMatch, rateGoalkeeper, rateOutfieldPlayer } from './matchRating';
import { autoPickBestXI } from './lineup';
import { simulateMatch, type MatchEvent, type RawPlayerMatchStat, type SimPlayer } from './simulation';
import type { Player } from '../types';

export type ClubMatchInputs = {
  formation: FormationKey;
  assignment: SlotAssignment;
};

/** Uses a saved lineup if provided, otherwise auto-picks a default 4-3-3 XI. */
export function buildClubMatchInputs(
  players: Player[],
  savedLineup?: { formation: FormationKey; assignment: SlotAssignment }
): ClubMatchInputs {
  if (savedLineup) return savedLineup;
  const formation: FormationKey = '4-3-3';
  return { formation, assignment: autoPickBestXI(players, formation) };
}

function deterministicAttendance(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const fraction = (hash >>> 0) / 4294967296;
  return Math.round(8000 + fraction * 34000);
}

/** Same mulberry32 as simulation.ts/ratings.ts — separate stream, seeded
 * off the fixture id + a suffix, for the post-match rolls (injuries) that
 * simulateMatch itself doesn't need to know about. */
function makeAftermathRng(fixtureId: string): () => number {
  let t = 0;
  const str = `${fixtureId}:aftermath`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  t = hash >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function toSimSquad(assignment: SlotAssignment, playersById: Map<string, Player>): SimPlayer[] {
  return Object.values(assignment)
    .filter((id): id is string => id != null)
    .map((id) => playersById.get(id))
    .filter((p): p is Player => p != null)
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      position: p.position,
      shooting: p.shooting,
      passing: p.passing,
      defending: p.defending,
    }));
}

export type MatchStatRow = RawPlayerMatchStat & {
  fixture_id: string;
  club_id: string;
  match_rating: number;
  motm: boolean;
};

export type PlayerConditionUpdate = {
  playerId: string;
  fatigue_points: number;
  fatigue_level: FatigueLevel;
  /** Only set (ISO date) if newly injured this match; otherwise carries the existing value forward. */
  injured_until: string | null;
  suspended_matches: number;
  form: number;
  season_goals: number;
  season_assists: number;
  season_apps: number;
  season_minutes: number;
};

export type ClubFormUpdate = {
  /** Last 5 results, oldest first, most recent last -- e.g. "WWDLW". Truncated to 5 chars. */
  form_string: string;
  momentum: number;
};

export type ProcessedFixtureResult = {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  attendance: number;
  homeClubRating: number;
  awayClubRating: number;
  statRows: MatchStatRow[];
  playerUpdates: PlayerConditionUpdate[];
  homeForm: ClubFormUpdate;
  awayForm: ClubFormUpdate;
};

export type ProcessFixtureParams = {
  fixtureId: string;
  homeClubId: string;
  awayClubId: string;
  home: ClubMatchInputs;
  away: ClubMatchInputs;
  /** Every player on the home club's books, not just the starting XI — needed to recover fatigue for those who didn't play. */
  homeFullSquad: Player[];
  awayFullSquad: Player[];
  /** Days since each club's previous fixture (normally 7, one round/week) — used for the recovery side of fatigue. */
  restDays?: number;
  /** Season-to-date yellow count (BEFORE this match) for players who might pick one up this match — for the 5-yellows-is-a-ban rule. Missing entries treated as 0. */
  priorSeasonYellows?: Map<string, number>;
  /** Each club's form_string/momentum BEFORE this match (empty string / 0 for a club with no history yet). */
  homeFormBefore: ClubFormUpdate;
  awayFormBefore: ClubFormUpdate;
  /** League fixtures each club has already played BEFORE this match -- computeMomentum's n is min(this, 5). */
  homeMatchesPlayedBefore: number;
  awayMatchesPlayedBefore: number;
};

function nextFormUpdate(before: ClubFormUpdate, matchesPlayedBefore: number, result: MatchResultLetter): ClubFormUpdate {
  const form_string = (before.form_string + result).slice(-5);
  const letters = form_string.split('') as MatchResultLetter[];
  const formPoints = computeFormPoints(letters);
  const momentum = computeMomentum(formPoints, matchesPlayedBefore + 1);
  return { form_string, momentum };
}

function conditionUpdateFor(
  player: Player,
  played: boolean,
  minutesPlayed: number,
  restDays: number,
  matchRating: number | null,
  isRedCarded: boolean,
  seasonYellowsAfter: number | null,
  aftermathRng: () => number
): PlayerConditionUpdate {
  const fatiguePointsBefore = player.fatigue_points ?? 0;
  const levelBefore = fatigueLevelForPoints(fatiguePointsBefore);
  const age = player.age ?? 25;

  const fatiguePoints = played
    ? accumulateFatigue(fatiguePointsBefore, minutesPlayed, age)
    : recoverFatigue(fatiguePointsBefore, restDays, age);
  const fatigueLevel = fatigueLevelForPoints(fatiguePoints);

  let injuredUntil = player.injured_until;
  let suspendedMatches = player.suspended_matches ?? 0;

  if (played) {
    // Injury risk is about how fatigued they *were* going into the match.
    const weeksInjured = rollInjury(levelBefore, aftermathRng);
    if (weeksInjured != null) {
      const until = new Date();
      until.setDate(until.getDate() + weeksInjured * 7);
      injuredUntil = until.toISOString().slice(0, 10);
    }

    if (isRedCarded) suspendedMatches += 1;
    if (seasonYellowsAfter != null && seasonYellowsAfter > 0 && seasonYellowsAfter % 5 === 0) {
      suspendedMatches += 1;
    }
  } else if (suspendedMatches > 0) {
    // A round passing without this player being selected still serves out
    // part of a ban (the league moved on regardless).
    suspendedMatches -= 1;
  }

  const form = played && matchRating != null ? Math.round((( player.form ?? 6.5) * 0.7 + matchRating * 0.3) * 10) / 10 : (player.form ?? 6.5);

  return {
    playerId: player.id,
    fatigue_points: Math.round(fatiguePoints),
    fatigue_level: fatigueLevel,
    injured_until: injuredUntil,
    suspended_matches: suspendedMatches,
    form,
    season_goals: player.season_goals ?? 0,
    season_assists: player.season_assists ?? 0,
    season_apps: player.season_apps ?? 0,
    season_minutes: player.season_minutes ?? 0,
  };
}

export function processFixture(params: ProcessFixtureParams): ProcessedFixtureResult {
  const restDays = params.restDays ?? 7;
  const priorYellows = params.priorSeasonYellows ?? new Map<string, number>();

  const homePlayersById = new Map(params.homeFullSquad.map((p) => [p.id, p]));
  const awayPlayersById = new Map(params.awayFullSquad.map((p) => [p.id, p]));
  const allPlayersById = new Map([...homePlayersById, ...awayPlayersById]);

  const homeXI = startingXIFrom(params.home.formation, params.home.assignment, homePlayersById);
  const awayXI = startingXIFrom(params.away.formation, params.away.assignment, awayPlayersById);
  if (!homeXI || !awayXI) {
    throw new Error('processFixture requires a complete 11-player XI for both clubs.');
  }

  const homeRating = computeClubRating(homeXI);
  const awayRating = computeClubRating(awayXI);

  const result = simulateMatch({
    seed: params.fixtureId,
    homeRating: homeRating.overall,
    awayRating: awayRating.overall,
    homeMomentum: params.homeFormBefore.momentum,
    awayMomentum: params.awayFormBefore.momentum,
    homeSquad: toSimSquad(params.home.assignment, homePlayersById),
    awaySquad: toSimSquad(params.away.assignment, awayPlayersById),
  });

  const rateRow = (raw: RawPlayerMatchStat): number =>
    raw.position === 'GK'
      ? rateGoalkeeper({
          started: raw.started,
          minutesPlayed: raw.minutesPlayed,
          saves: raw.saves,
          cleanSheet: raw.cleanSheet,
          goalsConceded: raw.goalsConceded,
        })
      : rateOutfieldPlayer({
          position: raw.position as Exclude<typeof raw.position, 'GK'>,
          started: raw.started,
          minutesPlayed: raw.minutesPlayed,
          goals: raw.goals,
          assists: raw.assists,
          shotsOnTarget: raw.shotsOnTarget,
          shotsOffTarget: Math.max(0, raw.shots - raw.shotsOnTarget),
          keyPasses: raw.keyPasses,
          passesAttempted: raw.passesAttempted,
          passesCompleted: raw.passesCompleted,
          tackles: raw.tackles,
          interceptions: raw.interceptions,
          duelsWon: raw.duelsWon,
          duelsLost: raw.duelsLost,
          cleanSheet: raw.cleanSheet,
          goalsConceded: raw.goalsConceded,
          yellowCards: raw.yellowCards,
          redCards: raw.redCards,
          ownGoals: raw.ownGoals,
          penaltiesMissed: raw.penaltiesMissed,
        });

  const buildRows = (raws: RawPlayerMatchStat[], clubId: string): MatchStatRow[] => {
    const ratings = raws.map((raw) => ({ raw, rating: rateRow(raw) }));
    const motmId = pickManOfTheMatch(
      [...ratings].map(({ raw, rating }) => ({ playerId: raw.playerId, rating, goals: raw.goals, assists: raw.assists }))
    );
    return ratings.map(({ raw, rating }) => ({
      ...raw,
      fixture_id: params.fixtureId,
      club_id: clubId,
      match_rating: rating,
      motm: raw.playerId === motmId,
    }));
  };

  // MOTM is picked per side above for building rows, but the match's
  // overall MOTM is the single best across both — recompute once more
  // across everyone so exactly one row (not two) ends up flagged.
  const homeRowsPrelim = buildRows(result.homePlayerStats, params.homeClubId);
  const awayRowsPrelim = buildRows(result.awayPlayerStats, params.awayClubId);
  const overallMotmId = pickManOfTheMatch(
    [...homeRowsPrelim, ...awayRowsPrelim].map((r) => ({
      playerId: r.playerId,
      rating: r.match_rating,
      goals: r.goals,
      assists: r.assists,
    }))
  );
  const finalize = (rows: MatchStatRow[]) => rows.map((r) => ({ ...r, motm: r.playerId === overallMotmId }));
  const statRows = [...finalize(homeRowsPrelim), ...finalize(awayRowsPrelim)];

  const aftermathRng = makeAftermathRng(params.fixtureId);
  const statsByPlayer = new Map(statRows.map((r) => [r.playerId, r]));

  const playerUpdates: PlayerConditionUpdate[] = [];
  for (const player of allPlayersById.values()) {
    const stat = statsByPlayer.get(player.id);
    const played = stat != null;
    const isRedCarded = (stat?.redCards ?? 0) > 0;
    const yellowsThisMatch = stat?.yellowCards ?? 0;
    const seasonYellowsAfter = played ? (priorYellows.get(player.id) ?? 0) + yellowsThisMatch : null;

    const update = conditionUpdateFor(
      player,
      played,
      stat?.minutesPlayed ?? 0,
      restDays,
      stat?.match_rating ?? null,
      isRedCarded,
      seasonYellowsAfter,
      aftermathRng
    );

    if (played && stat) {
      update.season_goals = (player.season_goals ?? 0) + stat.goals;
      update.season_assists = (player.season_assists ?? 0) + stat.assists;
      update.season_apps = (player.season_apps ?? 0) + 1;
      update.season_minutes = (player.season_minutes ?? 0) + stat.minutesPlayed;
    }

    playerUpdates.push(update);
  }

  const homeResultLetter: MatchResultLetter =
    result.homeGoals > result.awayGoals ? 'W' : result.homeGoals < result.awayGoals ? 'L' : 'D';
  const awayResultLetter: MatchResultLetter =
    result.awayGoals > result.homeGoals ? 'W' : result.awayGoals < result.homeGoals ? 'L' : 'D';

  return {
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    events: result.events,
    attendance: deterministicAttendance(params.fixtureId),
    homeClubRating: homeRating.overall,
    awayClubRating: awayRating.overall,
    statRows,
    playerUpdates,
    homeForm: nextFormUpdate(params.homeFormBefore, params.homeMatchesPlayedBefore, homeResultLetter),
    awayForm: nextFormUpdate(params.awayFormBefore, params.awayMatchesPlayedBefore, awayResultLetter),
  };
}

// Kept for anything that only needs a quick attack/defence-style rating
// preview without the full match-processing pipeline (e.g. spot-checks).
export { effectiveOverall };
