# Israeli Football Manager

A football club management game for web and mobile, starting with the
Israeli Premier League (Ligat ha'Al). Players manage a club: squad,
tactics, fixtures, and league progression.

**Status:** core gameplay loop works end to end: auth → pick a club → view
your real squad → build a lineup → play matches (simulated) → watch the
table update. Still missing: transfers, finances, and a cup competition.

## Stack

- **Expo** (React Native) with **expo-router** (file-based routing) — SDK ~57.
- **react-native-web**, so the same codebase runs in the browser
  (`npx expo start --web`) as well as iOS/Android via Expo Go.
- **TypeScript**, strict mode.
- **Supabase** (Postgres + Auth) as the backend, via `@supabase/supabase-js`.
- **react-native-svg** for generated crests and the lineup pitch markings.
- **react-native-reanimated** for press feedback / entrance / sheet transitions.
- Package manager: **npm**. Testing: **vitest** (`npm test`). Running
  standalone TS scripts: **tsx**.

## Folder structure

```
app/
  _layout.tsx        Root layout. Dark-only (no light/dark branching) —
                      wraps everything in AuthProvider, registers routes.
  sign-in.tsx         Email/password sign in + sign up.
  pick-club.tsx       Grid of crest cards; claim an unmanaged club
                      (sets profiles.managed_club_id).
  (tabs)/             Route group = the bottom tab bar. Auth-gated once,
                      here, for all four tabs (not per-screen).
    _layout.tsx        Session/managed-club guard + loads the managed
                       club's colours into ClubThemeProvider.
    index.tsx          "/" — Squad: header (crest/name/rating/att-mid-def
                       bars), sortable/filterable player list, tap a
                       player for PlayerDetailSheet. Switch Club / Sign Out.
    lineup.tsx          Formation switcher, pitch with shirt tokens,
                       tap-slot-then-tap-bench to swap, live rating,
                       auto-pick, save.
    fixtures.tsx        Fixtures grouped by round, "Play Next Match",
                       tap a played match for MatchTimelineSheet.
    table.tsx           League standings, your club highlighted.

src/
  components/     Shared UI. ClubCrest, OverallBadge, PositionPill, StatBar,
                   PressableScale (shared tap-feedback wrapper used
                   everywhere), PlayerDetailSheet, MatchTimelineSheet,
                   PlaceholderScreen, club-crest-images.ts (bundled crest
                   asset lookup, see "Visual identity" below).
  theme/           Dark-only design tokens (colors, spacing, typography)
                   + ClubThemeProvider/useClubTheme (injects the managed
                   club's colours via context).
  lib/             Non-UI logic.
                   supabase.ts        the Supabase client.
                   auth-context.tsx   AuthProvider/useAuth.
                   use-profile.ts     useProfile(session).
                   ratings.ts         player/club rating engine (pure).
                   formations.ts      formation slot maps (pure data).
                   lineup.ts          out-of-position penalties, live
                                      lineup rating, auto-pick XI (pure).
                   simulation.ts      seeded match engine (pure).
                   fixtures.ts        round-robin season generator (pure).
                   standings.ts       league table computation (pure).
                   play-match.ts      bridges a club's squad+lineup to
                                      simulation.ts (pure-ish; the actual
                                      Supabase orchestration lives in
                                      app/(tabs)/fixtures.tsx).
  types/           Shared TypeScript types (index.ts mirrors the DB schema).
  data/            Static seed data (plain data, no logic) for local dev/testing.

scripts/           Standalone admin scripts (service_role key, run via tsx).
                   backfill-ratings.ts, generate-fixtures.ts.

supabase/
  migrations/      Hand-written SQL migrations, applied in filename order.
                   No Supabase CLI/local stack — run manually via the SQL
                   Editor (0001, 0003, 0005, 0006, 0007) or, for pure data
                   migrations, via direct API calls with the service_role
                   key (0002, 0004 — see below).

assets/
  crests/          The 14 clubs' real crest images — user-supplied, local/
                   internal use only (see "Visual identity" below). NOT
                   fetched or sourced by Claude.
  images/, expo.icon/   App icon, splash screen, favicon.
```

Path alias: `@/*` resolves to `src/*` (see `tsconfig.json`), except
`@/assets/*` which resolves to the top-level `assets/*`.

## Database schema

- **clubs** — `id, name, short_name, league, budget, logo_url`, plus
  (`0006`) `primary_colour, secondary_colour, crest_initials` (all
  nullable — see "Visual identity").
- **players** — `id, club_id -> clubs, full_name, position (GK|DF|MF|FW),
  birth_date (nullable), age (nullable), market_value, weekly_wage,
  contract_until, nationality`, plus (`0005`) the rating columns:
  `overall, potential, pace, shooting, passing, dribbling, defending,
  physical` (smallint, nullable until backfilled — see "Rating system"),
  `preferred_foot`, `height_cm`. `age` exists because bulk-source data
  (Transfermarkt) gives age, not exact `birth_date` — prefer `birth_date`
  when both are populated.
- **fixtures** — `id, competition (league|cup), round, kickoff_at,
  home_club_id -> clubs, away_club_id -> clubs, home_goals, away_goals,
  status (scheduled|live|finished|postponed)`, plus (`0007`) `attendance`,
  `home_lineup_id`/`away_lineup_id -> lineups`, and `events` (jsonb — the
  simulated `MatchEvent[]`, persisted so re-opening a match's timeline
  can't drift from its stored score; see "Football layer").
- **profiles** — `id -> auth.users, display_name, managed_club_id -> clubs,
  cash_balance, created_at`.
- **lineups** (`0007`) — `id, profile_id -> profiles, formation, created_at`.
  One manager can have multiple over time; the lineup screen always loads
  the most recent.
- **lineup_slots** (`0007`) — `lineup_id, player_id, slot_key, is_starter`,
  PK `(lineup_id, slot_key)`. `slot_key` matches a formation's slot keys
  from `src/lib/formations.ts` (e.g. `"LB"`, `"CM1"`).

RLS: `clubs`, `players`, `fixtures` are readable by anyone. `fixtures` is
also **updatable by any authenticated user** (`0007`) — a deliberate,
documented simplification: fixtures/the table are shared league-wide state,
not owned by one manager, so a per-owner policy doesn't fit; "Play Next
Match" needs to be able to write results from a plain user session. Revisit
before any real multi-user use. `profiles` and `lineups`/`lineup_slots` are
owner-only (`auth.uid() = profile_id`, `lineup_slots` via a join back to
its parent lineup).

`src/types/index.ts` mirrors these tables by hand. **When the schema
changes, update both the migration and the types together** — there's no
codegen wired up yet (`supabase gen types typescript` would be worth
adding once the Supabase CLI is in use).

Migrations so far: `0001` initial schema, `0002` seeds the 14 real clubs,
`0003` adds `players.age`, `0004` seeds all 393 real players, `0005` adds
the rating columns, `0006` adds club colours/crest initials, `0007` adds
lineups/lineup_slots + the fixtures tactics/events columns + the fixtures
update policy. `0002`/`0004` (pure data) were run via direct API calls
(service_role key) rather than the SQL editor; `0001`/`0003`/`0005`/`0006`/
`0007` are schema changes (DDL) and need the SQL Editor — Claude has no
DDL-capable credential, only the service_role/publishable API keys, which
can't run `alter table`/`create table`.

## Visual identity

- `src/theme/` — dark-only palette (no light/dark toggle; this product
  commits to one broadcast-style dark look), spacing/typography scales,
  and `ClubThemeProvider`/`useClubTheme` (injects the managed club's
  `primary_colour`/`secondary_colour`, falling back to a neutral accent
  until `0006` is backfilled). Typography approximates a "condensed
  broadcast" feel with heavy weight + uppercase + tight letter-spacing on
  system fonts, not a bundled custom font (kept dependency-free).
- `src/components/ClubCrest.tsx` — priority order: `logo_url` (a properly
  licensed hosted asset, if one is ever set) → the bundled local crest
  (`src/components/club-crest-images.ts`, keyed by `short_name`) → a
  generated placeholder shield (diagonal split of the club's two colours
  + initials).
- **`assets/crests/`** contains the 14 clubs' real crest images. These
  were supplied locally by the user for this app's internal-use-only
  running — Claude does not fetch or redistribute club logo artwork (that's
  actual copyrighted/trademarked material, unlike the factual player/club
  data compiled elsewhere in this project). Two files were ambiguous to
  match from their source filenames — `bsa.png` (Ihud Bnei Sakhnin) vs
  `hbs.png` (Hapoel Be'er Sheva) — flagged as unconfirmed in
  `club-crest-images.ts`; swap the two `require()` paths if backwards.
  **Before pushing this repo anywhere public or shared, reconsider
  whether `assets/crests/` should go with it.**

## Rating system

- `src/lib/ratings.ts` — pure, deterministic functions (no I/O): given the
  same inputs they always return the same outputs. That's required for
  `scripts/backfill-ratings.ts` to be idempotent, and it's what makes the
  functions unit-testable (`src/lib/ratings.test.ts`, run via `npm test`).
  - `computeOverall(marketValueEur, age, position)` — log-scaled off market
    value, adjusted by age bracket, clamped to [45, 88]. Takes `age`, not
    `birthDate` as originally spec'd: our seeded player data is mostly
    `age` with no `birth_date`, so the function matches the data that
    actually exists. Use `ageFromBirthDate()` (also exported) to convert
    when you do have a real birth date. `position` is accepted for
    interface symmetry / future tuning but unused by the current formula.
  - `computePotential(overall, age)` — younger players get a bigger
    headroom bump above `overall`. "Random" is a deterministic hash of
    `(overall, age)`, not `Math.random()` — needed for idempotency.
  - `deriveAttributes(overall, position, playerId)` — spreads
    pace/shooting/passing/dribbling/defending/physical around `overall`
    using per-position weights, plus small variance seeded from
    `playerId` so a given player's numbers never change between runs.
  - `computeClubRating(players)` — best-11-by-overall, then
    attack/midfield/defence are that XI's FW/MF/DF group averages, and
    overall is their weighted mean (GK 15%, DF 30%, MF 30%, FW 25%). Used
    both for the squad screen's header bars and (via `lineup.ts`) for
    live lineup rating and match simulation inputs.
- `scripts/backfill-ratings.ts` — fetches every player, computes
  overall/potential/attributes, writes them back. Needs the service_role/
  secret key, passed as `SUPABASE_SECRET_KEY` at run time, never stored in
  `.env`: `SUPABASE_SECRET_KEY=sb_secret_... npm run backfill-ratings`.
  `preferred_foot`/`height_cm` aren't computed — no data source for them yet.

## Football layer

- `src/lib/formations.ts` — 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2 as slot
  maps on a 0-100 pitch grid (`x`: left-right, `y`: 0 = own goal line, 100
  = attacked goal line). Every slot is tagged with the position group
  (GK/DF/MF/FW) it expects — our data model has no separate
  attacking/defensive-midfield concept, so e.g. every non-GK/DF/FW slot in
  4-2-3-1 (both the double pivot and the front three) is tagged `MF`.
- `src/lib/lineup.ts` — out-of-position penalty (same group: 0, one group
  away on the GK-DF-MF-FW chain: -5, two+ away: -10), live lineup rating
  (feeds penalty-adjusted overalls through `computeClubRating`), a greedy
  `autoPickBestXI` (exact position matches first, then best-remaining-fit
  — not a true optimal assignment, but deterministic and good enough), and
  `shirtNumberFor(playerId)` — players have no stored squad number, so the
  lineup screen derives a stable display number from a hash of the id.
- `app/(tabs)/lineup.tsx` — loads the manager's most recent saved lineup
  (falls back to auto-pick if none exists, or if `lineups`/`lineup_slots`
  don't exist yet because `0007` hasn't been run — degrades gracefully
  rather than erroring). Tap a starter slot to select it, then tap another
  starter (swap) or a bench player (substitute); switching formation
  re-auto-picks from the full squad rather than trying to preserve
  incompatible slot mappings.
- `src/lib/simulation.ts` — deterministic, seeded (mulberry32 PRNG +
  FNV-1a hash of the seed, typically the fixture id). Expected goals per
  side from attack vs. opponent defence rating (log-free ratio model, ~1.35
  league-average goals/team, home advantage 1.12x), actual goals sampled
  via Knuth's Poisson algorithm. Goal scorers are weighted-random by
  `shooting` among outfield players (goalkeepers excluded from the pool);
  cards are Poisson-ish random with no attribute weighting. Pure — returns
  a `MatchResult`, no Supabase/UI in this file.
- `src/lib/fixtures.ts` — `generateSeasonFixtures`: standard circle-method
  round-robin, doubled (home + away) — 14 clubs → 26 rounds × 7 matches =
  182 fixtures. Requires an even team count (true for our 14; throws
  otherwise — no bye-round support). Tested in `fixtures.test.ts`
  (pairing/round/date-spacing correctness).
- `scripts/generate-fixtures.ts` — fetches clubs, generates the season,
  inserts it. Needs `SUPABASE_SECRET_KEY` (writes are service_role-only via
  this script's path); refuses to run if league fixtures already exist
  unless `--force` is passed, to avoid double-seeding a season.
- `src/lib/standings.ts` — `computeStandings`: points/W/D/L/GF/GA/GD from
  finished fixtures. Tiebreakers: points → goal difference → goals for →
  club name. **Simplification:** no head-to-head sub-table, which real
  league regulations often apply before goal difference. Tested in
  `standings.test.ts`.
- `src/lib/play-match.ts` + the "Play Next Match" button in
  `app/(tabs)/fixtures.tsx`: finds the manager's next `scheduled` fixture,
  simulates every fixture in that same round (not just the manager's —
  round-robin means all 14 clubs play every round), using each club's most
  recent saved lineup if one exists, else an auto-picked 4-3-3, and writes
  `home_goals`/`away_goals`/`events`/`attendance`/`status='finished'` back.
  This is a plain authenticated write, not a service_role script — see the
  `fixtures` RLS note above.

## Auth & club-claiming flow

- `app/sign-in.tsx` → email/password via `supabase.auth.signUp` /
  `signInWithPassword`. Supabase's default "Confirm email" setting applies —
  if it's on, a new user can't sign in until they click the confirmation
  email; toggle it off in the dashboard (Authentication → Providers →
  Email) for smoother local testing.
- On first sign-in, `useProfile` creates the user's `profiles` row
  automatically (`display_name` defaults to the email's local part).
- `app/pick-club.tsx` lists all clubs and lets the user claim one
  (`profiles.managed_club_id`). **Known simplification:** nothing stops two
  accounts from claiming the same club — `profiles` RLS is owner-read-only,
  so the client can't even see who's already claimed what. Fine for
  single-player use.
- `app/(tabs)/index.tsx` has a **Switch Club** action (clears
  `managed_club_id`, returns to `/pick-club`) — added after hitting this
  gap live: there was previously no way back once a club was claimed.
- Auth gating: no session → `/sign-in`; session but no `managed_club_id` →
  `/pick-club`; otherwise the `(tabs)` group. `(tabs)/_layout.tsx`
  centralizes this check once for all four tabs; `sign-in.tsx`/
  `pick-club.tsx` each do their own minimal check (redirect away if
  already satisfied).

## Conventions

- Screens live in `app/`; anything reusable across screens goes in `src/`.
- Env vars consumed by client code must be prefixed `EXPO_PUBLIC_` (Expo's
  convention for exposing a var to app code) — see `.env.example`.
  `src/lib/supabase.ts` reads `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/supabase.ts` does **not** throw if those env vars are missing —
  it falls back to a placeholder client and exports `isSupabaseConfigured`
  instead, so the app can show a helpful message instead of crashing.
- SQL migrations are plain `.sql` files, numbered sequentially
  (`000N_description.sql`), applied by hand for now. Keep each migration
  additive/forward-only rather than editing a past one, once it's been run
  against the real project.
- File naming: kebab-case for non-component files/hooks (`use-profile.ts`,
  `club-theme.tsx`); PascalCase for component files (`ClubCrest.tsx`,
  `PressableScale.tsx`) — the newer convention, post visual-identity
  rebuild. A few original scaffold files predate this and don't fully
  match; not worth a mass rename.
- Pure logic (no Supabase, no React) lives in `src/lib/*.ts` and is
  unit-tested with vitest where it's non-trivial (`ratings`, `fixtures`,
  `standings`). UI orchestration (fetch, write, loading/error state) stays
  in the screen component rather than leaking into the lib files — keeps
  the lib layer testable and reusable (e.g. by scripts).
- Standalone admin scripts (`scripts/*.ts`, run via `tsx`) that need
  write access take the service_role/secret key via a `SUPABASE_SECRET_KEY`
  env var passed at invocation time — never written to `.env` or committed.

## Known non-obvious things

- This repo lives at the top level of `israeli-football-manager/`. A
  sibling folder, `אפליציית כדורגל/add ons app/`, holds a portable copy of
  Node.js (no system-wide Node install was done) plus `install_tools.bat`.
  It's local machine tooling, not project source — it's git-ignored and
  irrelevant to the app itself. If `node`/`npm` aren't on PATH in a new
  terminal, that folder needs to be added to PATH for the session (or
  install Node.js properly, system-wide).
- `assets/crests/` holds real, user-supplied club logo images — see
  "Visual identity" above before pushing/sharing this repo.
