// Lineup business logic: out-of-position penalties, fatigue-aware live
// club rating, and a greedy auto-pick. Pure functions — no Supabase, no
// React — same reasoning as ratings.ts (testable, and safe to call from
// the UI on every edit without side effects).

import { formations, type FormationKey, type FormationSlot } from './formations';
import { effectiveOverall, type FatigueLevel } from './fatigue';
import type { Player, PlayerPosition } from '../types';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// GK - DF - MF - FW: a linear chain. Same group = no penalty; one step
// away ("adjacent", e.g. a DF played at MF) = -5; two+ steps away
// ("unrelated", e.g. a DF played at FW, or anyone played at GK) = -10.
const GROUP_ORDER: PlayerPosition[] = ['GK', 'DF', 'MF', 'FW'];

export function positionPenalty(expectedGroup: PlayerPosition, actualPosition: PlayerPosition): number {
  const distance = Math.abs(GROUP_ORDER.indexOf(expectedGroup) - GROUP_ORDER.indexOf(actualPosition));
  if (distance === 0) return 0;
  if (distance === 1) return -5;
  return -10;
}

/**
 * Player's overall in this slot: fatigue's effectiveOverall applied first
 * (its own floor of 40), then the out-of-position penalty on top of that
 * (which can push a tired player fielded out of position below 40 — two
 * penalties stacking is intentional, not a bug). Never below 1.
 */
export function adjustedOverall(
  player: Pick<Player, 'overall' | 'position' | 'fatigue_level'>,
  slotGroup: PlayerPosition
): number {
  const base = player.overall ?? 0;
  const effective = effectiveOverall(base, player.fatigue_level ?? 'fresh');
  return Math.max(1, effective + positionPenalty(slotGroup, player.position));
}

// players has no stored squad number -- derive a stable display number
// from the player id instead (same FNV-1a-ish approach as ratings.ts),
// deterministic per player, purely cosmetic for the lineup UI.
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function shirtNumberFor(playerId: string): number {
  return (hashString(playerId) % 99) + 1;
}

export type SlotAssignment = Record<string, string | null>; // slot key -> player id | null

// --- club rating: THE club rating (0008_performance.sql) -----------------

export type StartingXIEntry = { slotGroup: PlayerPosition; player: Player };

// Branded so a plain number (e.g. player.overall, or ratings.ts's
// estimateSquadRating output) cannot be passed where an effective XI
// rating is required — this is the "assert in code" that matchOdds.ts's
// computeDiff cannot regress to the true overall: it's a *compile* error,
// not a runtime check, because a runtime check has no way to tell an
// effective rating from a raw one (they're both just numbers in the same
// range). The brand only exists at the type level (erased at runtime) and
// is only ever produced here, by computeClubRating.
declare const effectiveRatingBrand: unique symbol;
export type EffectiveRatingValue = number & { readonly [effectiveRatingBrand]: true };

export type EffectiveClubRating = {
  overall: EffectiveRatingValue;
  attack: EffectiveRatingValue;
  midfield: EffectiveRatingValue;
  defence: EffectiveRatingValue;
};
// Back-compat alias -- most existing call sites (squad screen, lineup
// screen headers, etc.) just display these numbers and don't care that
// they're branded (number & {brand} is still assignable anywhere a plain
// number is expected).
export type ClubRating = EffectiveClubRating;

/**
 * The one club rating. Takes the actual starting XI — exactly 11 players,
 * each with the slot group they're playing — and computes a weighted mean
 * of their *effective* overalls (fatigue applied, then the
 * out-of-position penalty). attack/midfield/defence are the FW/MF/DF slot
 * groups' averages within that same XI.
 *
 * Unlike ratings.ts's estimateSquadRating, this does no "pick the best 11"
 * selection — the XI you pass in is definitionally the XI, whether it's
 * good or bad. Throws if it isn't exactly 11 (a lineup that isn't full
 * doesn't have a rating; the caller should ensure completeness first).
 */
export function computeClubRating(startingXI: StartingXIEntry[]): EffectiveClubRating {
  if (startingXI.length !== 11) {
    throw new Error(`computeClubRating requires exactly 11 players (got ${startingXI.length})`);
  }

  const effectiveFor = (group: PlayerPosition) =>
    startingXI.filter((entry) => entry.slotGroup === group).map((entry) => adjustedOverall(entry.player, group));

  const gk = average(effectiveFor('GK'));
  const df = average(effectiveFor('DF'));
  const mf = average(effectiveFor('MF'));
  const fw = average(effectiveFor('FW'));

  return {
    overall: Math.round(gk * 0.15 + df * 0.3 + mf * 0.3 + fw * 0.25) as EffectiveRatingValue,
    attack: Math.round(fw) as EffectiveRatingValue,
    midfield: Math.round(mf) as EffectiveRatingValue,
    defence: Math.round(df) as EffectiveRatingValue,
  };
}

/** Builds computeClubRating's input from a formation + slot assignment. Returns null if incomplete. */
export function startingXIFrom(
  formationKey: FormationKey,
  assignment: SlotAssignment,
  playersById: Map<string, Player>
): StartingXIEntry[] | null {
  const slots = formations[formationKey];
  const entries: StartingXIEntry[] = [];
  for (const slot of slots) {
    const playerId = assignment[slot.key];
    const player = playerId ? playersById.get(playerId) : undefined;
    if (!player) return null;
    entries.push({ slotGroup: slot.group, player });
  }
  return entries;
}

/** Convenience wrapper: computeClubRating from a formation + assignment, or a zeroed rating if incomplete. */
export function computeLineupRating(
  formationKey: FormationKey,
  assignment: SlotAssignment,
  playersById: Map<string, Player>
): EffectiveClubRating {
  const xi = startingXIFrom(formationKey, assignment, playersById);
  if (!xi) {
    const zero = 0 as EffectiveRatingValue;
    return { overall: zero, attack: zero, midfield: zero, defence: zero };
  }
  return computeClubRating(xi);
}

/**
 * Greedy auto-pick: for each slot, take the best remaining player (by
 * *effective* overall, so tired players naturally rotate out) whose actual
 * position exactly matches the slot's group; once a group runs dry, fill
 * remaining slots with whoever's left, preferring the smallest penalty
 * (closest group) and then highest effective overall. Not a true optimal
 * assignment (that's a much harder problem) but a reasonable, deterministic
 * "best available XI". Injured/suspended players are excluded outright.
 */
export function autoPickBestXI(players: Player[], formationKey: FormationKey): SlotAssignment {
  const slots = formations[formationKey];
  const today = new Date().toISOString().slice(0, 10);
  const eligible = players.filter((p) => {
    const injured = p.injured_until != null && p.injured_until >= today;
    const suspended = (p.suspended_matches ?? 0) > 0;
    return !injured && !suspended;
  });

  const effectiveRaw = (p: Player) => effectiveOverall(p.overall ?? 0, p.fatigue_level ?? 'fresh');
  const available = [...eligible].sort((a, b) => effectiveRaw(b) - effectiveRaw(a));
  const used = new Set<string>();
  const assignment: SlotAssignment = {};

  // Pass 1: exact position matches, best effective overall first, in slot order.
  for (const slot of slots) {
    const pick = available.find((p) => !used.has(p.id) && p.position === slot.group);
    if (pick) {
      assignment[slot.key] = pick.id;
      used.add(pick.id);
    }
  }

  // Pass 2: fill anything still empty with the least-penalized remaining player.
  for (const slot of slots) {
    if (assignment[slot.key]) continue;
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of available) {
      if (used.has(p.id)) continue;
      const score = adjustedOverall(p, slot.group);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      assignment[slot.key] = best.id;
      used.add(best.id);
    } else {
      assignment[slot.key] = null;
    }
  }

  return assignment;
}

export function benchPlayers(players: Player[], assignment: SlotAssignment): Player[] {
  const used = new Set(Object.values(assignment).filter((id): id is string => id != null));
  return players.filter((p) => !used.has(p.id));
}

export type { FormationSlot, FatigueLevel };
