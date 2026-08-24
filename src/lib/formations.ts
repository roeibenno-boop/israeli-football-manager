// Formation slot maps: pure data, no logic. Coordinates are on a 0-100
// pitch grid where x=0/100 is the left/right touchline and y=0 is the
// defended goal line, y=100 the attacked goal line (i.e. the team always
// attacks "up" toward y=100, regardless of which side is home/away — the
// UI is responsible for flipping this for display if it ever needs to).
//
// Every formation totals exactly 11 slots (1 GK + 10 outfield), matching
// its name (e.g. 4-3-3 = 4 DF + 3 MF + 3 FW). `group` is the position
// (GK/DF/MF/FW) a player is expected to fill that slot — used by
// src/lib/lineup.ts to work out the out-of-position penalty. Formations
// like 4-2-3-1 have no separate "defensive/attacking midfield" concept in
// our data model (players only have GK/DF/MF/FW), so every non-GK/DF/FW
// slot in every formation is tagged MF.

import type { PlayerPosition } from '../types';

export type FormationKey = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '5-3-2';

export const FORMATION_KEYS: FormationKey[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'];

export type FormationSlot = {
  /** Unique within the formation, e.g. "LB", "CM1". Stored as lineup_slots.slot_key. */
  key: string;
  /** Short label for the shirt token, e.g. "LB", "CM". */
  label: string;
  x: number;
  y: number;
  group: PlayerPosition;
};

export const formations: Record<FormationKey, FormationSlot[]> = {
  '4-3-3': [
    { key: 'GK', label: 'GK', x: 50, y: 5, group: 'GK' },
    { key: 'LB', label: 'LB', x: 15, y: 22, group: 'DF' },
    { key: 'CB1', label: 'CB', x: 35, y: 18, group: 'DF' },
    { key: 'CB2', label: 'CB', x: 65, y: 18, group: 'DF' },
    { key: 'RB', label: 'RB', x: 85, y: 22, group: 'DF' },
    { key: 'CM1', label: 'CM', x: 30, y: 48, group: 'MF' },
    { key: 'CM2', label: 'CM', x: 50, y: 45, group: 'MF' },
    { key: 'CM3', label: 'CM', x: 70, y: 48, group: 'MF' },
    { key: 'LW', label: 'LW', x: 20, y: 80, group: 'FW' },
    { key: 'ST', label: 'ST', x: 50, y: 85, group: 'FW' },
    { key: 'RW', label: 'RW', x: 80, y: 80, group: 'FW' },
  ],
  '4-4-2': [
    { key: 'GK', label: 'GK', x: 50, y: 5, group: 'GK' },
    { key: 'LB', label: 'LB', x: 15, y: 22, group: 'DF' },
    { key: 'CB1', label: 'CB', x: 35, y: 18, group: 'DF' },
    { key: 'CB2', label: 'CB', x: 65, y: 18, group: 'DF' },
    { key: 'RB', label: 'RB', x: 85, y: 22, group: 'DF' },
    { key: 'LM', label: 'LM', x: 15, y: 50, group: 'MF' },
    { key: 'CM1', label: 'CM', x: 38, y: 47, group: 'MF' },
    { key: 'CM2', label: 'CM', x: 62, y: 47, group: 'MF' },
    { key: 'RM', label: 'RM', x: 85, y: 50, group: 'MF' },
    { key: 'ST1', label: 'ST', x: 38, y: 82, group: 'FW' },
    { key: 'ST2', label: 'ST', x: 62, y: 82, group: 'FW' },
  ],
  '4-2-3-1': [
    { key: 'GK', label: 'GK', x: 50, y: 5, group: 'GK' },
    { key: 'LB', label: 'LB', x: 15, y: 22, group: 'DF' },
    { key: 'CB1', label: 'CB', x: 35, y: 18, group: 'DF' },
    { key: 'CB2', label: 'CB', x: 65, y: 18, group: 'DF' },
    { key: 'RB', label: 'RB', x: 85, y: 22, group: 'DF' },
    { key: 'DM1', label: 'DM', x: 35, y: 42, group: 'MF' },
    { key: 'DM2', label: 'DM', x: 65, y: 42, group: 'MF' },
    { key: 'LAM', label: 'AM', x: 18, y: 65, group: 'MF' },
    { key: 'CAM', label: 'AM', x: 50, y: 62, group: 'MF' },
    { key: 'RAM', label: 'AM', x: 82, y: 65, group: 'MF' },
    { key: 'ST', label: 'ST', x: 50, y: 85, group: 'FW' },
  ],
  '3-5-2': [
    { key: 'GK', label: 'GK', x: 50, y: 5, group: 'GK' },
    { key: 'CB1', label: 'CB', x: 25, y: 18, group: 'DF' },
    { key: 'CB2', label: 'CB', x: 50, y: 15, group: 'DF' },
    { key: 'CB3', label: 'CB', x: 75, y: 18, group: 'DF' },
    { key: 'LWB', label: 'LWB', x: 10, y: 48, group: 'MF' },
    { key: 'CM1', label: 'CM', x: 33, y: 45, group: 'MF' },
    { key: 'CM2', label: 'CM', x: 50, y: 42, group: 'MF' },
    { key: 'CM3', label: 'CM', x: 67, y: 45, group: 'MF' },
    { key: 'RWB', label: 'RWB', x: 90, y: 48, group: 'MF' },
    { key: 'ST1', label: 'ST', x: 38, y: 82, group: 'FW' },
    { key: 'ST2', label: 'ST', x: 62, y: 82, group: 'FW' },
  ],
  '5-3-2': [
    { key: 'GK', label: 'GK', x: 50, y: 5, group: 'GK' },
    { key: 'LWB', label: 'LWB', x: 10, y: 28, group: 'DF' },
    { key: 'CB1', label: 'CB', x: 30, y: 18, group: 'DF' },
    { key: 'CB2', label: 'CB', x: 50, y: 15, group: 'DF' },
    { key: 'CB3', label: 'CB', x: 70, y: 18, group: 'DF' },
    { key: 'RWB', label: 'RWB', x: 90, y: 28, group: 'DF' },
    { key: 'CM1', label: 'CM', x: 30, y: 48, group: 'MF' },
    { key: 'CM2', label: 'CM', x: 50, y: 45, group: 'MF' },
    { key: 'CM3', label: 'CM', x: 70, y: 48, group: 'MF' },
    { key: 'ST1', label: 'ST', x: 38, y: 82, group: 'FW' },
    { key: 'ST2', label: 'ST', x: 62, y: 82, group: 'FW' },
  ],
};
