// Deterministic, seeded match engine. Pure -- no Supabase, no UI. Same seed
// + same inputs always produces the same result, which matters both for
// testability and so a match can be safely re-derived (e.g. re-fetched)
// without silently changing its own outcome.
//
// Callers are expected to pass EFFECTIVE (fatigue-adjusted) attack/defence
// ratings -- see src/lib/lineup.ts's computeClubRating -- so a tired XI
// genuinely creates fewer/worse chances and concedes more. This file has
// no fatigue concept of its own; it just trusts the ratings it's given.
//
// Known simplifications, documented rather than half-implemented: no
// substitutions (all 11 starters play the full 90 -- matches what the
// lineup screen can even express), own goals always 0, penalties always 0
// (goals scored via penalty aren't distinguished from open play).

import type { PlayerPosition } from '../types';

type SeededRng = () => number;

function hashSeed(seed: number | string): number {
  const str = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 -- deterministic PRNG, returns a float in [0, 1) each call. */
function makeRng(seed: number | string): SeededRng {
  let t = hashSeed(seed);
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Knuth's algorithm for sampling a Poisson-distributed integer. */
function samplePoisson(lambda: number, rng: SeededRng): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > l);
  return k - 1;
}

/** Weighted-random pick from a list, using `weight` (must be > 0 for at least one item). */
function weightedPick<T>(items: T[], weight: (item: T) => number, rng: SeededRng): T | null {
  const weights = items.map((item) => Math.max(0.01, weight(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0 || items.length === 0) return null;
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const LEAGUE_AVERAGE_GOALS = 1.35;
const LEAGUE_AVERAGE_RATING = 65;
const HOME_ADVANTAGE = 1.12;

/** Expected goals for one side, from its attack rating vs the opponent's defence rating. */
export function expectedGoals(attack: number, opponentDefence: number, isHome: boolean): number {
  const attackFactor = attack / LEAGUE_AVERAGE_RATING;
  const defenceFactor = LEAGUE_AVERAGE_RATING / Math.max(1, opponentDefence);
  const xg = LEAGUE_AVERAGE_GOALS * attackFactor * defenceFactor * (isHome ? HOME_ADVANTAGE : 1);
  return Math.min(4.5, Math.max(0.2, xg));
}

export type SimPlayer = {
  id: string;
  name: string;
  position: PlayerPosition;
  shooting: number | null;
  passing: number | null;
  defending: number | null;
};

export type MatchEvent =
  | {
      minute: number;
      type: 'goal';
      team: 'home' | 'away';
      playerId: string;
      playerName: string;
      assistPlayerId?: string;
      assistPlayerName?: string;
    }
  | { minute: number; type: 'yellow_card'; team: 'home' | 'away'; playerId: string; playerName: string }
  | { minute: number; type: 'red_card'; team: 'home' | 'away'; playerId: string; playerName: string };

/** One player's generated stat line for the match. Counting stats only -- no rating/MOTM (matchRating.ts's job). */
export type RawPlayerMatchStat = {
  playerId: string;
  position: PlayerPosition;
  started: boolean;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  passesAttempted: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  duelsWon: number;
  duelsLost: number;
  saves: number;
  goalsConceded: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltiesScored: number;
  penaltiesMissed: number;
};

export type MatchResult = {
  homeGoals: number;
  awayGoals: number;
  homeXG: number;
  awayXG: number;
  events: MatchEvent[];
  homePlayerStats: RawPlayerMatchStat[];
  awayPlayerStats: RawPlayerMatchStat[];
};

export type SimulateMatchParams = {
  /** Any value that uniquely identifies this match -- e.g. the fixture id. */
  seed: number | string;
  homeAttack: number;
  homeDefence: number;
  awayAttack: number;
  awayDefence: number;
  homeSquad: SimPlayer[];
  awaySquad: SimPlayer[];
};

function scorerPool(squad: SimPlayer[]): SimPlayer[] {
  const outfield = squad.filter((p) => p.position !== 'GK');
  return outfield.length > 0 ? outfield : squad;
}

function generateGoalEvents(
  count: number,
  team: 'home' | 'away',
  squad: SimPlayer[],
  rng: SeededRng
): MatchEvent[] {
  const pool = scorerPool(squad);
  const events: MatchEvent[] = [];

  for (let i = 0; i < count; i++) {
    const scorer = weightedPick(pool, (p) => p.shooting ?? 50, rng);
    if (!scorer) continue;

    let assistPlayerId: string | undefined;
    let assistPlayerName: string | undefined;
    // Not every goal has a clear single assist (solo runs, headers from a
    // scramble, penalties) -- roughly 3 in 4 do.
    if (rng() < 0.75) {
      const assistPool = pool.filter((p) => p.id !== scorer.id);
      const assister = weightedPick(assistPool, (p) => p.passing ?? 50, rng);
      if (assister) {
        assistPlayerId = assister.id;
        assistPlayerName = assister.name;
      }
    }

    events.push({
      minute: 1 + Math.floor(rng() * 90),
      type: 'goal',
      team,
      playerId: scorer.id,
      playerName: scorer.name,
      assistPlayerId,
      assistPlayerName,
    });
  }

  return events;
}

/** Position-scaled baseline stat generation, consistent with the actual goals/cards from `events`. */
function generateSquadStats(
  squad: SimPlayer[],
  ownGoalsScored: number,
  goalsConceded: number,
  events: MatchEvent[],
  team: 'home' | 'away',
  rng: SeededRng
): RawPlayerMatchStat[] {
  const cleanSheet = goalsConceded === 0;
  const goalsByPlayer = new Map<string, number>();
  const assistsByPlayer = new Map<string, number>();
  const yellowsByPlayer = new Map<string, number>();
  const redsByPlayer = new Map<string, number>();

  for (const event of events) {
    if (event.team !== team) continue;
    if (event.type === 'goal') {
      goalsByPlayer.set(event.playerId, (goalsByPlayer.get(event.playerId) ?? 0) + 1);
      if (event.assistPlayerId) {
        assistsByPlayer.set(event.assistPlayerId, (assistsByPlayer.get(event.assistPlayerId) ?? 0) + 1);
      }
    } else if (event.type === 'yellow_card') {
      yellowsByPlayer.set(event.playerId, (yellowsByPlayer.get(event.playerId) ?? 0) + 1);
    } else if (event.type === 'red_card') {
      redsByPlayer.set(event.playerId, (redsByPlayer.get(event.playerId) ?? 0) + 1);
    }
  }

  const gk = squad.find((p) => p.position === 'GK');
  let totalOpponentShotsOnTargetFaced = 0;

  const outfieldStats: RawPlayerMatchStat[] = squad
    .filter((p) => p.position !== 'GK')
    .map((p) => {
      const shootingAttr = p.shooting ?? 50;
      const passingAttr = p.passing ?? 50;
      const defendingAttr = p.defending ?? 50;
      const shotVolumeFactor = p.position === 'FW' ? 1.3 : p.position === 'MF' ? 1.0 : 0.6;

      const goals = goalsByPlayer.get(p.id) ?? 0;
      const shotsOnTargetRaw = Math.round(shotVolumeFactor * (0.4 + rng() * 1.8) * (shootingAttr / 70));
      const shotsOnTarget = Math.max(goals, shotsOnTargetRaw);
      const shotsOffTarget = Math.round(shotVolumeFactor * rng() * 2);
      const shots = shotsOnTarget + shotsOffTarget;
      totalOpponentShotsOnTargetFaced += shotsOnTarget;

      const passVolumeFactor = p.position === 'DF' || p.position === 'MF' ? 1.15 : 0.75;
      const passesAttempted = Math.round((22 + rng() * 38) * passVolumeFactor * (passingAttr / 70));
      const completionRate = clamp01(0.65 + (passingAttr - 50) / 200 + (rng() - 0.5) * 0.15);
      const passesCompleted = Math.round(passesAttempted * completionRate);

      const keyPasses = Math.round(rng() * 3 * (passingAttr / 70) * (p.position === 'MF' ? 1.3 : 1));

      const defenceVolumeFactor = p.position === 'DF' ? 1.4 : p.position === 'MF' ? 1.0 : 0.3;
      const tackles = Math.round(rng() * 4 * defenceVolumeFactor * (defendingAttr / 70));
      const interceptions = Math.round(rng() * 3 * defenceVolumeFactor * (defendingAttr / 70));

      const duelsTotal = 4 + Math.round(rng() * 6);
      const duelWinProb = clamp01(0.5 + (defendingAttr - 50) / 200);
      let duelsWon = 0;
      for (let i = 0; i < duelsTotal; i++) {
        if (rng() < duelWinProb) duelsWon += 1;
      }

      return {
        playerId: p.id,
        position: p.position,
        started: true,
        minutesPlayed: 90,
        goals,
        assists: assistsByPlayer.get(p.id) ?? 0,
        shots,
        shotsOnTarget,
        keyPasses,
        passesAttempted,
        passesCompleted,
        tackles,
        interceptions,
        duelsWon,
        duelsLost: duelsTotal - duelsWon,
        saves: 0,
        goalsConceded,
        cleanSheet,
        yellowCards: yellowsByPlayer.get(p.id) ?? 0,
        redCards: redsByPlayer.get(p.id) ?? 0,
        // Own goals / penalties: not modeled by this generator (see file
        // header) -- always 0, regardless of `ownGoalsScored` (currently
        // always 0 too; the parameter exists for a future data source).
        ownGoals: 0,
        penaltiesScored: 0,
        penaltiesMissed: 0,
      };
    });

  void ownGoalsScored;

  const gkStats: RawPlayerMatchStat[] = gk
    ? [
        {
          playerId: gk.id,
          position: 'GK',
          started: true,
          minutesPlayed: 90,
          goals: 0,
          assists: 0,
          shots: 0,
          shotsOnTarget: 0,
          keyPasses: 0,
          passesAttempted: Math.round(15 + rng() * 15),
          passesCompleted: Math.round((15 + rng() * 15) * 0.75),
          tackles: 0,
          interceptions: 0,
          duelsWon: 0,
          duelsLost: 0,
          // Saves reconcile against shots the defence actually faced,
          // minus the goals let in -- keeps the box score internally
          // consistent (saves + goals conceded ~= shots on target faced).
          saves: Math.max(0, totalOpponentShotsOnTargetFaced - goalsConceded),
          goalsConceded,
          cleanSheet,
          yellowCards: yellowsByPlayer.get(gk.id) ?? 0,
          redCards: redsByPlayer.get(gk.id) ?? 0,
          ownGoals: 0,
          penaltiesScored: 0,
          penaltiesMissed: 0,
        },
      ]
    : [];

  return [...gkStats, ...outfieldStats];
}

export function simulateMatch(params: SimulateMatchParams): MatchResult {
  const rng = makeRng(params.seed);

  const homeXG = expectedGoals(params.homeAttack, params.awayDefence, true);
  const awayXG = expectedGoals(params.awayAttack, params.homeDefence, false);

  const homeGoals = samplePoisson(homeXG, rng);
  const awayGoals = samplePoisson(awayXG, rng);

  const events: MatchEvent[] = [
    ...generateGoalEvents(homeGoals, 'home', params.homeSquad, rng),
    ...generateGoalEvents(awayGoals, 'away', params.awaySquad, rng),
  ];

  // Cards: a handful of yellows most matches, reds rare.
  const yellowCount = samplePoisson(3.2, rng);
  const addCards = (count: number, type: 'yellow_card' | 'red_card') => {
    for (let i = 0; i < count; i++) {
      const team: 'home' | 'away' = rng() < 0.5 ? 'home' : 'away';
      const squad = team === 'home' ? params.homeSquad : params.awaySquad;
      if (squad.length === 0) continue;
      const player = squad[Math.floor(rng() * squad.length)];
      events.push({ minute: 1 + Math.floor(rng() * 90), type, team, playerId: player.id, playerName: player.name });
    }
  };
  addCards(yellowCount, 'yellow_card');
  if (rng() < 0.06) addCards(1, 'red_card');

  events.sort((a, b) => a.minute - b.minute);

  const homePlayerStats = generateSquadStats(params.homeSquad, 0, awayGoals, events, 'home', rng);
  const awayPlayerStats = generateSquadStats(params.awaySquad, 0, homeGoals, events, 'away', rng);

  return { homeGoals, awayGoals, homeXG, awayXG, events, homePlayerStats, awayPlayerStats };
}
