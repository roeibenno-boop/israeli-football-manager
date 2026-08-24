// Lineup business logic: out-of-position penalties, live rating
// recalculation, and a greedy auto-pick. Pure functions — no Supabase, no
// React — same reasoning as ratings.ts (testable, and safe to call from
// the UI on every edit without side effects).

import type { FormationKey, FormationSlot } from './formations';
import { formations } from './formations';
import { computeClubRating, type ClubRating } from './ratings';
import type { Player, PlayerPosition } from '../types';

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

/** Player's overall, adjusted for playing out of position in this slot. Never below 1. */
export function adjustedOverall(player: Pick<Player, 'overall' | 'position'>, slotGroup: PlayerPosition): number {
  const base = player.overall ?? 0;
  return Math.max(1, base + positionPenalty(slotGroup, player.position));
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

/** Live club rating for the current XI, accounting for out-of-position penalties. */
export function computeLineupRating(
  formationKey: FormationKey,
  assignment: SlotAssignment,
  playersById: Map<string, Player>
): ClubRating {
  const slots = formations[formationKey];
  const rated = slots
    .map((slot) => {
      const playerId = assignment[slot.key];
      const player = playerId ? playersById.get(playerId) : undefined;
      if (!player) return null;
      return { position: slot.group, overall: adjustedOverall(player, slot.group) };
    })
    .filter((p): p is { position: PlayerPosition; overall: number } => p !== null);

  return computeClubRating(rated);
}

/**
 * Greedy auto-pick: for each slot, take the best remaining player whose
 * actual position exactly matches the slot's group; once a group runs dry,
 * fill remaining slots with whoever's left, preferring the smallest
 * penalty (closest group) and then highest raw overall. Not a true
 * optimal assignment (that's a much harder problem) but a reasonable,
 * deterministic "best available XI".
 */
export function autoPickBestXI(players: Player[], formationKey: FormationKey): SlotAssignment {
  const slots = formations[formationKey];
  const available = [...players].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  const used = new Set<string>();
  const assignment: SlotAssignment = {};

  // Pass 1: exact position matches, best overall first, in slot order.
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

export type { FormationSlot };
