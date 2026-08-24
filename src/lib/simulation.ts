// Deterministic, seeded match engine. Pure -- no Supabase, no UI. Same seed
// + same inputs always produces the same result, which matters both for
// testability and so a match can be safely re-derived (e.g. re-fetched)
// without silently changing its own outcome.

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
  position: 'GK' | 'DF' | 'MF' | 'FW';
  shooting: number | null;
};

export type MatchEvent =
  | { minute: number; type: 'goal'; team: 'home' | 'away'; playerId: string; playerName: string }
  | { minute: number; type: 'yellow_card'; team: 'home' | 'away'; playerId: string; playerName: string }
  | { minute: number; type: 'red_card'; team: 'home' | 'away'; playerId: string; playerName: string };

export type MatchResult = {
  homeGoals: number;
  awayGoals: number;
  homeXG: number;
  awayXG: number;
  events: MatchEvent[];
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
  // Goalkeepers essentially never score -- exclude them from the weighted pool.
  const outfield = squad.filter((p) => p.position !== 'GK');
  return outfield.length > 0 ? outfield : squad;
}

export function simulateMatch(params: SimulateMatchParams): MatchResult {
  const rng = makeRng(params.seed);

  const homeXG = expectedGoals(params.homeAttack, params.awayDefence, true);
  const awayXG = expectedGoals(params.awayAttack, params.homeDefence, false);

  const homeGoals = samplePoisson(homeXG, rng);
  const awayGoals = samplePoisson(awayXG, rng);

  const events: MatchEvent[] = [];

  const addGoals = (count: number, team: 'home' | 'away', squad: SimPlayer[]) => {
    const pool = scorerPool(squad);
    for (let i = 0; i < count; i++) {
      const scorer = weightedPick(pool, (p) => p.shooting ?? 50, rng);
      if (!scorer) continue;
      events.push({
        minute: 1 + Math.floor(rng() * 90),
        type: 'goal',
        team,
        playerId: scorer.id,
        playerName: scorer.name,
      });
    }
  };
  addGoals(homeGoals, 'home', params.homeSquad);
  addGoals(awayGoals, 'away', params.awaySquad);

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

  return { homeGoals, awayGoals, homeXG, awayXG, events };
}
