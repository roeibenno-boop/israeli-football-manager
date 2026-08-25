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

  // Performance (0008_performance.sql). Derived live from the club's
  // starting XI (src/lib/lineup.ts's computeClubRating) and persisted
  // when a lineup is saved — see CLAUDE.md's "Club rating" section for why
  // AI clubs (nobody ever saves a lineup for them) don't get one from
  // normal gameplay alone.
  current_rating: number | null;

  // Davidson match-odds model (0009_match_odds.sql). Last 5 results,
  // oldest first / most recent last (e.g. "WWDLW"), and the momentum
  // figure derived from it — see src/lib/matchOdds.ts's computeMomentum.
  // Both null until the club's first fixture is played.
  form_string: string | null;
  momentum: number | null;
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

  // Condition (0008_performance.sql). fatigue_level is the UI-facing
  // state; fatigue_points is the hidden 0-100 counter behind it — see
  // src/lib/fatigue.ts. form/injured_until/suspended_matches and the
  // season_* aggregates update after every simulated match
  // (src/lib/play-match.ts).
  fatigue_level: FatigueLevel;
  fatigue_points: number;
  form: number | null;
  injured_until: ISODate | null;
  suspended_matches: number | null;
  season_goals: number;
  season_assists: number;
  season_apps: number;
  season_minutes: number;
}

export type FatigueLevel = 'fresh' | 'moderate' | 'tired';

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

  // Season lifecycle (0010_seasons.sql). Nullable -- pre-0010 rows that
  // predate seasons entirely stay null if the backfill had nothing to
  // attach them to (see the migration). Every fixture generated from here
  // on always gets one (src/lib/season-actions.ts).
  season_id: UUID | null;
}

export interface Profile {
  /** References auth.users(id) */
  id: UUID;
  display_name: string | null;
  managed_club_id: UUID | null;
  cash_balance: number;
  created_at: ISOTimestamp;

  // Season lifecycle (0010_seasons.sql). The manager's currently-active
  // season -- null between "picked/ended a season" and "claimed a club",
  // i.e. exactly while app/pick-club.tsx is showing.
  current_season_id: UUID | null;
}

// Season lifecycle (0010_seasons.sql)

export interface Season {
  id: UUID;
  profile_id: UUID;
  /** 1, 2, 3, ... -- a manager's career count, carried across club switches (see CLAUDE.md's "Season lifecycle"). */
  season_number: number;
  club_id: UUID;
  started_at: ISOTimestamp;
  /** Set when the season is archived (a natural end, a club switch, or a Restart). */
  ended_at: ISOTimestamp | null;
  /** Final league position (1-14). Null for a Restart (there's no natural finish to record) or a season still in progress. */
  final_position: number | null;
  final_points: number | null;
  is_active: boolean;
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

// Performance (0008_performance.sql)

export interface PlayerMatchStat {
  id: UUID;
  fixture_id: UUID;
  player_id: UUID;
  club_id: UUID;
  minutes_played: number;
  started: boolean;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  key_passes: number;
  passes_attempted: number;
  passes_completed: number;
  tackles: number;
  interceptions: number;
  duels_won: number;
  duels_lost: number;
  saves: number;
  goals_conceded: number;
  clean_sheet: boolean;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  penalties_scored: number;
  penalties_missed: number;
  match_rating: number | null;
  motm: boolean;

  // Season lifecycle (0010_seasons.sql). See Fixture.season_id.
  season_id: UUID | null;
}
