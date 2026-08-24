// Shared TypeScript types for the app.
// These mirror the tables defined in supabase/migrations/0001_init.sql —
// keep the two in sync when the schema changes.

export type UUID = string;

/** ISO date string, e.g. "2026-08-24" */
export type ISODate = string;

/** ISO timestamp string, e.g. "2026-08-24T18:00:00Z" */
export type ISOTimestamp = string;

export interface Club {
  id: UUID;
  name: string;
  short_name: string;
  league: string;
  budget: number;
  logo_url: string | null;

  // Visual identity (0006_club_identity.sql). Nullable until backfilled —
  // see src/components/ClubCrest.tsx for the fallback behavior.
  primary_colour: string | null;
  secondary_colour: string | null;
  crest_initials: string | null;
}

export type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW';
export type PreferredFoot = 'left' | 'right' | 'both';

export interface Player {
  id: UUID;
  club_id: UUID;
  full_name: string;
  position: PlayerPosition;
  /** Exact date of birth, when known. Prefer `age` when only that is available. */
  birth_date: ISODate | null;
  /** Age in years, e.g. from a bulk data source that doesn't expose exact birth_date. */
  age: number | null;
  market_value: number;
  weekly_wage: number;
  contract_until: ISODate | null;
  nationality: string;

  // Rating system (0005_ratings.sql). Nullable until
  // scripts/backfill-ratings.ts has been run for a given player — see
  // src/lib/ratings.ts for how these are computed.
  overall: number | null;
  potential: number | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  preferred_foot: PreferredFoot | null;
  height_cm: number | null;
}

export type Competition = 'league' | 'cup';
export type FixtureStatus = 'scheduled' | 'live' | 'finished' | 'postponed';

export interface Fixture {
  id: UUID;
  competition: Competition;
  round: number;
  kickoff_at: ISOTimestamp;
  home_club_id: UUID;
  away_club_id: UUID;
  home_goals: number | null;
  away_goals: number | null;
  status: FixtureStatus;

  // Tactics (0007_tactics.sql). Nullable — most fixtures are simulated
  // without either side ever setting an explicit lineup for the AI side.
  attendance: number | null;
  home_lineup_id: UUID | null;
  away_lineup_id: UUID | null;
  /** MatchEvent[] from src/lib/simulation.ts, set once the fixture is simulated. */
  events: unknown[] | null;
}

export interface Profile {
  /** References auth.users(id) */
  id: UUID;
  display_name: string | null;
  managed_club_id: UUID | null;
  cash_balance: number;
  created_at: ISOTimestamp;
}

// Tactics (0007_tactics.sql)

export type FormationName = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '5-3-2';

export interface Lineup {
  id: UUID;
  profile_id: UUID;
  formation: FormationName;
  created_at: ISOTimestamp;
}

export interface LineupSlot {
  lineup_id: UUID;
  player_id: UUID;
  /** e.g. "LB", "CM1" — see src/lib/formations.ts for the full set per formation. */
  slot_key: string;
  is_starter: boolean;
}
