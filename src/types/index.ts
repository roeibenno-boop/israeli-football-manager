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
}

export type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: UUID;
  club_id: UUID;
  full_name: string;
  position: PlayerPosition;
  birth_date: ISODate;
  market_value: number;
  weekly_wage: number;
  contract_until: ISODate | null;
  nationality: string;
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
}

export interface Profile {
  /** References auth.users(id) */
  id: UUID;
  display_name: string | null;
  managed_club_id: UUID | null;
  cash_balance: number;
  created_at: ISOTimestamp;
}
