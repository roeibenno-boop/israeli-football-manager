# Israeli Football Manager

A football club management game for web and mobile, starting with the
Israeli Premier League (Ligat ha'Al). Players manage a club: squad,
tactics, fixtures, and league progression.

**Status:** core gameplay loop works end to end: auth → pick a club → view
your real squad → build a lineup → play matches (simulated, generating full
per-player stats/ratings) → watch fatigue/form/injuries evolve and the
table update → reach the end of a season (a summary screen, then continue
with the same club — players age a year and progress — or manage a
different one) or restart a season from scratch. Still missing: transfers,
finances, and a cup competition.

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
                      wraps everything in AuthProvider, registers routes,
                      incl. the modal routes below.
  sign-in.tsx         Email/password sign in + sign up.
  pick-club.tsx       Grid of crest cards; claim an unmanaged club. Also
                      the landing point for every "start a season" flow
                      (first-ever claim, end-of-season club switch, a
                      Restart) — see "Season lifecycle".
  match/[fixtureId].tsx  Modal. Pre-match preview for a scheduled fixture:
                      both crests, effective XI ratings, FormGuides,
                      MomentumLabels — see "Match outcome model".
  season-summary.tsx  Modal, no swipe-to-dismiss. The end-of-season screen
                      — see "Season lifecycle".
  settings.tsx        Modal. Currently just "Restart Season" (behind a
                      confirmation dialog) — see "Season lifecycle".
  club/[clubId].tsx    Modal. Read-only club page (crest/name/table
                      position/rating/full squad by position) — opened via
                      "View club" from the Table tab's League Table.
  (tabs)/             Route group = the bottom tab bar. Auth-gated once,
                      here, for all five tabs (not per-screen).
    _layout.tsx        Session/managed-club guard + loads the managed
                       club's colours into ClubThemeProvider.
    index.tsx          "/" — Squad: header (crest/name/rating/att-mid-def
                       bars), sortable/filterable player list, tap a
                       player for PlayerDetailSheet. Settings / Switch
                       Club / Sign Out.
    lineup.tsx          Formation switcher, pitch with shirt tokens
                       (sized to fit the viewport, not fixed), a
                       sortable/filterable bench with a live rating-change
                       preview, two auto-pick modes, save — see "Football
                       layer"'s lineup screen entry for the full rebuild.
    performance.tsx      Sortable squad stats table (+ separate GK
                       section), tap a player for PlayerMatchLogSheet.
    fixtures.tsx        Fixtures grouped by round, "Play Next Match" (runs
                       the full match-processing pipeline — see "Player
                       condition & match performance"), tap a played match
                       for MatchTimelineSheet, tap a scheduled one for the
                       pre-match preview. Routes to season-summary.tsx
                       when the round it just played was the season's last.
    table.tsx           League hub: League Table / Scorers / Rating tabs
                       — see "Football layer"'s table screen entry for the
                       full rebuild.

src/
  components/     Shared UI. ClubCrest, OverallBadge (now fatigue-aware —
                   see below), PositionPill, StatBar, FatigueDot,
                   PressableScale (shared tap-feedback wrapper used
                   everywhere), FormGuide/MomentumLabel, PlayerDetailSheet,
                   MatchTimelineSheet, PlayerMatchLogSheet,
                   ScorersLeadersTab/RatingLeadersTab (the Table screen's
                   other two tabs — see "Football layer"), PlaceholderScreen,
                   club-crest-images.ts (bundled crest asset lookup, see
                   "Visual identity" below).
  theme/           Dark-only design tokens (colors incl. fatigueColors,
                   spacing, typography) + ClubThemeProvider/useClubTheme
                   (injects the managed club's colours via context).
  lib/             Non-UI logic.
                   supabase.ts        the Supabase client.
                   auth-context.tsx   AuthProvider/useAuth.
                   use-profile.ts     useProfile(session).
                   ratings.ts         player rating engine + estimateSquadRating (pure).
                   fatigue.ts         the 0-100 fatigue counter + effectiveOverall (pure).
                   matchRating.ts     1.0-10.0 post-match player ratings (pure).
                   formations.ts      formation slot maps (pure data).
                   lineup.ts          out-of-position penalties + THE club
                                      rating (computeClubRating), two
                                      auto-pick modes (pure) — see
                                      "Football layer".
                   simulation.ts      seeded match engine incl. full
                                      per-player stat generation (pure).
                   matchOdds.ts       the exact closed-form Davidson match
                                      outcome model (pure) — see "Match
                                      outcome model".
                   fixtures.ts        round-robin season generator (pure).
                   standings.ts       league table computation (pure).
                   leaders.ts         season leaderboards from raw match
                                      stats (pure).
                   season.ts          player aging/rating progression +
                                      season-boundary reset defaults
                                      (pure) — see "Season lifecycle".
                   season-actions.ts  the season-lifecycle I/O
                                      orchestration shared by
                                      settings.tsx/season-summary.tsx/
                                      pick-club.tsx — see "Season lifecycle".
                   play-match.ts      processFixture: runs simulation.ts,
                                      rates every player (matchRating.ts),
                                      picks MOTM, works out fatigue/injury/
                                      suspension/season-stat/form-momentum
                                      updates for every player and both
                                      clubs (pure — the actual Supabase
                                      orchestration lives in
                                      app/(tabs)/fixtures.tsx).
  types/           Shared TypeScript types (index.ts mirrors the DB schema).
  data/            Static seed data (plain data, no logic) for local dev/testing.

scripts/           Standalone admin scripts (run via tsx).
                   backfill-ratings.ts, generate-fixtures.ts (service_role
                   key — data writes; superseded for in-app use by
                   season-actions.ts's generateFixturesForSeason, which
                   runs from a plain authenticated session and tags every
                   fixture with a season_id — this script is still useful
                   for direct DB repair, but doesn't set one). run-migration.ts
                   (database password — schema DDL; see "Migrations" below).

supabase/
  migrations/      Hand-written SQL migrations, applied in filename order.
                   No Supabase CLI/local stack — applied via
                   scripts/run-migration.ts (a direct Postgres connection)
                   once a database password was available (0005 onward);
                   0001-0003 predate that and were run via the SQL Editor.

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
  can't drift from its stored score; see "Football layer"), plus (`0010`)
  `season_id -> seasons` (nullable — see "Season lifecycle").
- **profiles** — `id -> auth.users, display_name, managed_club_id -> clubs,
  cash_balance, created_at`, plus (`0010`) `current_season_id -> seasons`
  (see "Season lifecycle").
- **seasons** (`0010`) — `id, profile_id -> profiles, season_number,
  club_id -> clubs, started_at, ended_at, final_position, final_points,
  is_active`. One row per manager per season, including one row per club a
  manager has ever managed across their career — `season_number` keeps
  incrementing across a club switch (it's a career count, not reset), but
  does reset to 1 on a Restart (a genuine do-over, not a season passing).
  See "Season lifecycle".
- **lineups** (`0007`) — `id, profile_id -> profiles, formation, created_at`.
  One manager can have multiple over time; the lineup screen always loads
  the most recent.
- **lineup_slots** (`0007`) — `lineup_id, player_id, slot_key, is_starter`,
  PK `(lineup_id, slot_key)`. `slot_key` matches a formation's slot keys
  from `src/lib/formations.ts` (e.g. `"LB"`, `"CM1"`).
- **players**, continued (`0008`) — condition columns: `fatigue_level`
  (fresh|moderate|tired), `fatigue_points` (hidden 0-100 counter behind
  it), `form` (rolling average, default 6.5), `injured_until` (date),
  `suspended_matches`, `season_goals`/`season_assists`/`season_apps`/
  `season_minutes`. See "Player condition & match performance".
- **clubs**, continued (`0008`) — `current_rating` (smallint). THE club
  rating (see "Football layer") — persisted when a lineup is saved and
  refreshed after each match played; null for a club nobody has ever
  saved a lineup for (in practice, any AI club — see below).
- **clubs**, continued (`0009`) — `form_string` (text, `^[WDL]{0,5}$`,
  oldest result first, newest last, capped at 5 — see "Match outcome
  model"), `momentum` (numeric(4,2)). Both null until a club's first match
  under the Davidson model; updated for both sides of every fixture
  `processFixture` writes.
- **player_match_stats** (`0008`) — one row per player per fixture they
  appeared in: `fixture_id, player_id, club_id, minutes_played, started`,
  the full counting-stats line (goals/assists/shots/passes/tackles/
  interceptions/duels/saves/cards/own_goals/penalties), `clean_sheet`,
  `match_rating` (1.0-10.0), `motm`. `unique(fixture_id, player_id)`, plus
  (`0010`) `season_id -> seasons` (nullable — see "Season lifecycle").

RLS: `clubs`, `players`, `fixtures`, `player_match_stats` are readable by
anyone. `fixtures`, `players`, and `clubs` are also **updatable by any
authenticated user** (`0007`/`0008`), and `player_match_stats` is
**insertable/updatable by any authenticated user** (`0008`) — a
deliberate, documented simplification: fixtures/the table/player condition
are shared league-wide state, not owned by one manager, so a per-owner
policy doesn't fit; "Play Next Match" needs to be able to write match
results and every affected player's condition from a plain user session.
Revisit before any real multi-user use. `profiles` and `lineups`/
`lineup_slots` are owner-only (`auth.uid() = profile_id`, `lineup_slots`
via a join back to its parent lineup). `seasons` (`0010`) is owner-only the
same way (`auth.uid() = profile_id`, select/insert/update, no delete —
seasons are archived, never removed). `fixtures` also gained **insert** and
**delete** policies, and `player_match_stats` a **delete** policy, both
"any authenticated user" (`0010`) — needed so Restart/rollover can wipe and
regenerate a season's fixture list from a plain session, same reasoning as
every other shared-state policy on this table.

`src/types/index.ts` mirrors these tables by hand. **When the schema
changes, update both the migration and the types together** — there's no
codegen wired up yet (`supabase gen types typescript` would be worth
adding once the Supabase CLI is in use).

Migrations so far: `0001` initial schema, `0002` seeds the 14 real clubs,
`0003` adds `players.age`, `0004` seeds all 393 real players, `0005` adds
the rating columns, `0006` adds club colours/crest initials, `0007` adds
lineups/lineup_slots + the fixtures tactics/events columns + the fixtures
update policy, `0008` adds player_match_stats + condition columns +
clubs.current_rating + their write policies, `0009` adds
`clubs.form_string`/`clubs.momentum` for the Davidson match outcome model,
`0010` adds `seasons` + `profiles.current_season_id` +
`fixtures`/`player_match_stats.season_id` + their RLS policies (requested
as `0006_seasons.sql`; 0006 was already used — renumbered, same pattern as
every migration since 0002). `0002`/`0004` (pure data) were run via direct
API calls (service_role key). `0001`-`0003` (DDL) were run via the SQL
Editor, back when that was the only option; `0005` onward were applied
directly via `scripts/run-migration.ts` (see "Migrations" in Conventions)
once a database password became available.

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
  - `estimateSquadRating(players)` — best-11-by-*raw* overall, then
    attack/midfield/defence are that XI's FW/MF/DF group averages, and
    overall is their weighted mean (GK 15%, DF 30%, MF 30%, FW 25%). Named
    `computeClubRating` before `0008_performance.sql` — renamed when a
    fatigue/lineup-aware version was added to `lineup.ts` under the old
    name (see "Football layer"); this one is now just a rough *estimate*
    from a squad list, used where no concrete starting XI exists (mainly:
    giving AI clubs — nobody ever saves a lineup for them — something to
    show on the pick-club screen).
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
  away on the GK-DF-MF-FW chain: -5, two+ away: -10), stacked with
  fatigue's `effectiveOverall` (fatigue applied first, position penalty on
  top — two penalties compounding on a tired player fielded out of
  position is intentional). `computeClubRating(startingXI)` is **the**
  club rating: takes the actual starting XI (exactly 11 `{slotGroup,
  player}` entries, no best-11 selection — the XI you give it *is* the
  XI), same GK/DF/MF/FW weighted-mean shape as `estimateSquadRating` but
  using effective overalls throughout. Two auto-pick modes, both sharing a
  private `greedyAssign(pool, slots)` (exact position matches by effective
  overall first, then best-remaining-fit — not a true optimal assignment,
  but deterministic and good enough) so they only differ in what pool they
  hand it: `autoPickBestXI` runs it over every eligible (non-injured/
  non-suspended) player — tired players naturally rotate out on merit
  since a tired player's effective overall is lower, but aren't excluded
  outright. `autoPickRotationXI` — for fixture congestion — excludes
  'tired' players from the pool *entirely* first; if that leaves fewer
  than 11 (a threadbare or badly-fatigued squad), the remaining slots are
  filled from whoever's left, freshest (lowest `fatigue_points`) first,
  tired or not, and it returns a `warning` string explaining that rather
  than silently leaving the XI incomplete.
  `shirtNumberFor(playerId)` — players have no stored squad number, so the
  lineup screen derives a stable display number from a hash of the id.
  `computeClubRating`'s return type is `EffectiveClubRating`, whose numbers
  are branded (`EffectiveRatingValue`, a TS nominal type — `number &
  {readonly [brand]: true}`) so that `matchOdds.ts`'s `computeDiff` can
  only be called with a genuine effective-XI rating, never a raw
  `player.overall` or `estimateSquadRating` output, at compile time. There's
  no runtime check possible here (an effective rating and a raw one are
  both just plain numbers in the same range) — this is what "enforce it in
  code" means when the two things you need to keep apart are structurally
  identical.
- `app/(tabs)/lineup.tsx` — loads the manager's most recent saved lineup
  (falls back to auto-pick if none exists, or if `lineups`/`lineup_slots`
  don't exist yet because `0007` hasn't been run — degrades gracefully
  rather than erroring). Tap a starter slot to select it, then tap another
  starter (swap) or a bench player (substitute); switching formation
  re-auto-picks from the full squad rather than trying to preserve
  incompatible slot mappings. Rebuilt (previously a fixed-size pitch that
  pushed the bench off-screen) around two hard constraints: the pitch is
  sized from `useWindowDimensions()`, not a fixed height — capped at
  55%/60% of the viewport height (mobile/web) and 520px wide, whichever is
  smallest, with shirt tokens at 44px/52px diameter — and the screen is a
  fixed header+pitch region above a bench region that scrolls
  *independently* (its own `FlatList`, `flex: 1`) rather than one long
  page scroll, so the pitch never scrolls off-screen chasing the bench.
  The bench itself is sortable (effective overall / true overall /
  fatigue / form / season average rating / position — `BenchSortKey`,
  default effective overall descending) and filterable (position chips +
  a "Fresh only" toggle); injured/suspended rows stay visible but greyed
  and unselectable. Selecting a pitch slot re-sorts the bench to surface
  same-position-group players first (via `positionPenalty`), and an
  out-of-position candidate shows its exact penalty inline ("-5 out of
  position"). Hovering (web) or press-and-holding (`onPressIn`/
  `onHoverIn`, both wired — `PressableScale` forwards whatever handlers
  it's given) a bench candidate while a slot is selected computes and
  shows a live "78 → 76" rating preview in the header via a second
  `computeLineupRating` call against the hypothetical post-swap
  assignment, without touching the real `assignment` state until the swap
  is actually confirmed with a tap. Auto-pick is now two buttons (Best XI
  / Rotation); a Rotation warning (see `autoPickRotationXI` above) renders
  as an inline banner rather than blocking anything.
- `src/lib/simulation.ts` — deterministic, seeded (mulberry32 PRNG +
  FNV-1a hash of the seed, typically the fixture id). Drives `matchOdds.ts`
  (below) for the actual outcome/scoreline: computes `D =
  computeDiff(homeRating, awayRating, homeMomentum, awayMomentum)`, gets
  `{homeGoals, awayGoals}` from `sampleScoreline(D, rng)`, and separately
  recomputes `homeXG`/`awayXG` (same mu formula `sampleScoreline` uses
  internally) purely so the UI has an expected-goals figure to show — it's
  display-only, not fed back into anything. Callers pass each side's
  *effective* (fatigue-adjusted) XI rating (`lineup.ts`'s
  `computeClubRating(...).overall`, an `EffectiveRatingValue`) plus each
  side's momentum (`matchOdds.ts`'s `computeMomentum`) — this file has no
  fatigue or form concept of its own, it just trusts what it's given, so a
  tired or out-of-form XI genuinely creates fewer/worse chances. Goal
  scorers are weighted-random by `shooting` among outfield players
  (goalkeepers excluded from the pool), each goal ~75% likely to also get
  a weighted-random (by `passing`) assist. Also generates a full per-player
  stat line for both full XIs (shots/passes/tackles/duels/saves,
  consistent with the actual goals/cards in `events`) — see "Player
  condition & match performance". Pure — returns a `MatchResult`, no
  Supabase/UI in this file. Known simplifications, documented rather than
  half-implemented: no substitutions (all 11 starters play the full 90),
  own goals and penalties always 0.

## Match outcome model

- `src/lib/matchOdds.ts` — the actual outcome/scoreline model: an exact
  closed-form Davidson (1970) model with a draw category. No
  approximations, no probability floors, no post-hoc normalisation.
  - `computeDiff(homeRating, awayRating, homeMomentum, awayMomentum)` — `D
    = (homeRating + HOME_ADVANTAGE + homeMomentum) - (awayRating +
    awayMomentum)`, the model's single strength differential.
  - `computeOutcomeProbabilities(D)` — `h = exp(LAMBDA*D/2)`, `a =
    exp(-LAMBDA*D/2)`, denom `= h + a + NU`; `{pHome: h/denom, pDraw:
    NU/denom, pAway: a/denom}`. Sums to exactly 1 by construction (shared
    denominator, nothing to normalise) and every outcome is strictly
    positive for any finite `D` (no floor needed — there's nothing to
    floor). `CONFIG`: `LAMBDA=0.16`, `NU=0.74`, `HOME_ADVANTAGE=3`,
    `MU_BASE=1.3`, `GOAL_TILT=0.0175`. `LAMBDA` controls how sharply the
    favourite's win probability grows with the rating gap; `NU` is the
    fixed "draw strength" both sides' exponential terms compete against
    (bigger `NU` → more draws at every `D`); `HOME_ADVANTAGE` is added to
    `D` as if the home side's rating were 3 points higher; `MU_BASE`/
    `GOAL_TILT` set the Poisson goal means (`MU_BASE * exp(±GOAL_TILT*D)`)
    used only for scoreline sampling and the display xG figure, not for
    the outcome probabilities themselves (those come from `D` directly).
  - `computeFormPoints(last5)` — W=3/D=1/L=0 over up to 5 results.
    `computeMomentum(formPoints, matchesPlayed)` — `0.4 * (formPoints -
    1.5 * min(matchesPlayed, 5))`; 1.5 pts/match is the neutral (all-draws)
    expectation, so this is exactly how far above/below neutral a club's
    recent form is, and it handles early season (fewer than 5 matches
    played) automatically via the `min`. Five wins → exactly +3.0, five
    losses → exactly -3.0.
  - `sampleScoreline(D, rng)` — draws the **outcome** first from
    `computeOutcomeProbabilities(D)`, then samples a scoreline conditioned
    on that outcome via exact rejection sampling: repeatedly draw
    independent Poisson(muHome)/Poisson(muAway) pairs (Knuth's algorithm)
    and accept the first pair whose `sign(homeGoals - awayGoals)` matches
    the drawn outcome. This is exact, not an approximation — the accepted
    pair follows the true Poisson distribution conditioned on the outcome.
    Capped at 200 rejections (effectively never hit at these mu values);
    on overflow falls back to a fixed scoreline per outcome and
    `console.warn`s, rather than looping forever or returning something
    inconsistent with the drawn outcome.
  - **The computed probabilities are never shown to the user anywhere in
    the app** — no odds, no percentages. `src/components/FormGuide.tsx`
    (`FormGuide`: W/D/L pills, green/grey/red, oldest-left; `MomentumLabel`:
    signed number like `"+3.0"`, green/red, renders nothing at exactly
    `0.0`) is the only outcome-adjacent thing a manager sees pre-match —
    both are descriptive (recent results, form trend), not predictive.
    `app/match/[fixtureId].tsx` (a modal route, tap a scheduled fixture in
    the Fixtures tab) is the pre-match preview: both crests, both effective
    XI ratings, both `FormGuide`s, both `MomentumLabel`s — enough to judge
    a match without being handed the odds.
  - Tested in `matchOdds.test.ts` (exact spec'd probability values to 4
    decimals, sum-to-1 within 1e-12 and strict positivity for `D` in
    [-60, 60], symmetry, momentum edge cases, a 100,000-trial check that
    realised outcome frequencies match the formula within 0.5%) and
    `season-simulation.test.ts` (200 simulated 26-round seasons among 14
    clubs with a realistic rating spread — reports actual computed numbers
    for champion mean points, title rate for the strongest squad,
    bottom-club mean points, and the home/away win-rate gap, plus a
    dedicated check that a fatigued XI measurably underperforms the same
    XI fresh). Per-file convention: if any assertion in either file fails,
    the actual numbers get reported, not silently patched by loosening the
    assertion or adjusting `CONFIG`.
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
  league regulations often apply before goal difference — still true after
  the table screen rebuild below, which reuses this same function and
  tiebreak order for its default sort rather than adding one. Tested in
  `standings.test.ts`.
- `app/(tabs)/table.tsx` — the league hub, three tabs (previously just a
  bare standings list). **League Table**: `computeStandings` output, one
  row per club — position, `ClubCrest`, full `club.name` (never
  `short_name`), a 3px leading colour bar in the club's own
  `primary_colour`, position-zone background tinting (top 2 "European
  Qualification", next 4 "Playoff Split", bottom 2 "Relegation Zone" —
  proportional to however many clubs are in the table, with a `Legend`
  below), a movement arrow versus the previous round (computed by calling
  `computeStandings` a second time over fixtures from before the latest
  finished round and comparing each club's index — dash if fewer than 2
  rounds have finished yet, i.e. nothing to compare against), and the
  user's club highlighted in its own theme accent. Column headers are
  tappable to re-sort (`SortKey`, three-state: desc → asc → back to the
  league-rules default); a compact/detailed density toggle hides GF/GA/
  W/D/L/Form (compact fits 375px with no horizontal scroll; detailed wraps
  in a horizontal `ScrollView`, header included, so it scrolls in sync).
  Tapping a row expands it in place (home/away W-D-L split, current streak
  — computed from that club's actual finished fixtures, not `form_string`,
  since a streak can run longer than the 5-match form window — top scorer,
  `current_rating`, next fixture) with a "View Club" action to
  `app/club/[clubId].tsx`, a read-only crest/table-position/full-squad
  page. **Scorers**: `ScorersLeadersTab` (`src/components/`), a Goals/
  Assists segmented control over `leaders.ts` rows sorted by that tally;
  top 3 get a larger row + medal colour (reusing `tierColors`' gold/
  silver/bronze), any row from the manager's own club is flagged
  regardless of rank, secondary line is goals/90 + `penaltiesScored` (for
  Goals) or `keyPasses` (for Assists) — both new `LeaderRow` fields (see
  below). **Rating**: `RatingLeadersTab`, `leaders.ts`'s
  `bestAverageRating` (min 5 apps, stated in the UI) with a position
  filter chip row (a top goalkeeper shouldn't need scrolling past thirty
  outfield players to find), plus a standalone "Goalkeeper of the Season"
  card (`mostCleanSheets` over the same min-5-apps pool). Tapping a player
  in either leaderboard opens `PlayerDetailSheet`. `leaders.ts`'s
  `LeaderRow` gained `penaltiesScored`/`keyPasses` aggregates for this
  (summed from `player_match_stats.penalties_scored`/`key_passes`,
  same shape as every other field on the row) — a small, backward-
  compatible addition, not a new source of truth.
- `src/lib/play-match.ts` (`processFixture`) + the "Play Next Match" button
  in `app/(tabs)/fixtures.tsx`: finds the manager's next `scheduled`
  fixture, processes every fixture in that same round (not just the
  manager's — round-robin means all 14 clubs play every round), using each
  club's most recent saved lineup if one exists, else an auto-picked
  4-3-3. Full pipeline per fixture — see "Player condition & match
  performance" for what "processes" means. Writes are plain authenticated
  writes, not a service_role script — see the RLS note above.

## Player condition & match performance

- `src/lib/fatigue.ts` — a hidden 0-100 `fatigue_points` counter drives
  three UI-facing states (`fresh`/`moderate`/`tired`, 0-33/34-66/67-100).
  `accumulateFatigue`/`recoverFatigue` both apply an age factor (older
  players tire faster and recover slower; under-23s the opposite) — a full
  90 minutes takes a fresh player to ~moderate, a second on top of that to
  tired; ~4-5 rest days (one round/week) brings moderate back to fresh.
  `effectiveOverall(overall, level)`: fresh +0, moderate -4, tired -11
  (floored at 40) — meant to visibly hurt, not nudge. `rollInjury(level,
  rng)` takes a caller-supplied seeded RNG (so injuries stay reproducible
  from a match seed) — risk 1%/3%/8% by level, 1-4 week duration.
- `src/components/OverallBadge.tsx` — the one place fatigue-aware display
  lives. Given a `fatigueLevel` that isn't `fresh`, renders `"72 (68)"`
  (true, then effective in brackets, coloured amber/red) instead of just
  `"72"` — every screen that shows a player's overall goes through this
  component, so it's consistent everywhere by construction, not by
  convention. `FatigueDot` (green/amber/red) is the standalone version for
  next to a name.
- `src/lib/matchRating.ts` — `rateOutfieldPlayer` (position-aware: e.g. a
  defender's goal bonus is bigger than a forward's, only defenders are
  penalized for goals conceded) and `rateGoalkeeper` (separate formula
  entirely — saves/clean sheets/goals conceded, plus `penaltiesSaved`/
  `errorsLeadingToGoal` fields that exist for the interface but our own
  simulation never populates, since it doesn't model penalty awards or
  keeper errors as distinct events). Both start from a 6.0 baseline, clamp
  to [1.0, 10.0]. A sub appearance under 20 minutes gets pulled back
  toward 6.0 rather than swinging on a handful of stats.
  `pickManOfTheMatch`: highest rating, ties broken by goals then assists.
- `src/lib/leaders.ts` — `buildLeaderRows(stats, players)` aggregates raw
  `player_match_stats` rows into season totals (goals/assists/avg rating/
  MOTM/clean sheets/cards/saves/minutes) *itself*, rather than trusting
  `players.season_*` (those are a display convenience updated alongside,
  not the source of truth here). `topScorers`/`topAssisters`/
  `bestAverageRating` (min 5 apps)/`mostMotm`/`mostCleanSheets` (GK only)/
  `mostCards`. "League-wide or per club" isn't a separate parameter — every
  row carries `clubId`, filter before calling.
- `src/lib/play-match.ts`'s `processFixture` is the full per-match
  pipeline: runs `simulation.ts` with both sides' `computeClubRating` and
  each side's pre-match `form_string`/`momentum` (caller-supplied — see
  below), rates every player who appeared via `matchRating.ts`, picks one
  overall MOTM, works out each side's next `form_string`/`momentum` from
  the actual result (`nextFormUpdate`, same formula as `matchOdds.ts`'s
  `computeFormPoints`/`computeMomentum`, reimplemented locally per the
  project's module-independence convention) and returns both as
  `homeForm`/`awayForm`, and for **every player on both full squads** (not
  just the 22 who
  played) works out: fatigue accumulate-or-recover, an injury roll for
  those who played (risk based on their fatigue level going *into* the
  match), a suspension decrement for anyone serving a ban who didn't play,
  a new ban for a red card or a 5th season yellow (needs the caller to
  supply prior season yellow counts — see below), a rolling `form` update
  (70% old / 30% this match's rating), and the season aggregate deltas.
  **Known simplifications**, all documented in the file itself: no
  substitutions (all 11 starters play the full 90 — matches what the
  lineup screen can even express), own goals and penalties always 0 (the
  stat generator doesn't model either as distinct events, though the
  columns/rating modifiers exist for a future data source).
- `app/(tabs)/fixtures.tsx`'s "Play Next Match" is the orchestration: for
  the round, fetches every involved club's full squad plus season-to-date
  yellow counts (`player_match_stats` aggregated per player, needed for
  the 5-yellows rule) and current `form_string`/`momentum` (from the
  already-loaded clubs list) plus matches-played-so-far (derived from the
  already-loaded fixtures list), calls `processFixture` per fixture, then
  writes `player_match_stats` (batch insert, tagged with the manager's
  `current_season_id`), every player's condition update (batched, chunks
  of 20 concurrent), and each club's refreshed `current_rating` **and**
  `form_string`/`momentum` in one combined update per club, and finally
  marks the fixtures `finished`. Both the fixtures query this screen loads
  and the stats it writes are scoped to `profile.current_season_id` —
  see "Season lifecycle". If the round just played leaves no `scheduled`
  fixtures anywhere in the season, that was the last round — routes to
  `/season-summary` instead of just reloading in place.
  **Not a single database transaction** — Supabase's client REST API has
  no cross-table transaction primitive; true atomicity would need a
  Postgres function (rewriting this whole pipeline in plpgsql), which is
  out of scope. `player_match_stats`' `unique(fixture_id, player_id)` at
  least means a retry after a partial failure fails loudly (constraint
  violation) instead of silently double-writing stats.
- `app/(tabs)/performance.tsx` — sortable table (tap a stat chip) for
  outfield players, a separate goalkeeper section (saves/clean sheets/
  save %), built from `leaders.ts` over that club's `player_match_stats`
  (scoped to `profile.current_season_id` — see "Season lifecycle"). Every
  row shows the fatigue dot + bracketed effective overall (via
  `OverallBadge`) and a form arrow (rolling `form` vs. that row's season
  average `avgRating` — up/down/flat within ±0.2). Injured/suspended
  players are visually greyed. Tap a player for `PlayerMatchLogSheet`
  (that player's match-by-match season log).

## Auth & club-claiming flow

- `app/sign-in.tsx` → email/password via `supabase.auth.signUp` /
  `signInWithPassword`. Supabase's default "Confirm email" setting applies —
  if it's on, a new user can't sign in until they click the confirmation
  email; toggle it off in the dashboard (Authentication → Providers →
  Email) for smoother local testing.
- On first sign-in, `useProfile` creates the user's `profiles` row
  automatically (`display_name` defaults to the email's local part).
- `app/pick-club.tsx` lists all clubs and lets the user claim one. Claiming
  now always starts a season (`src/lib/season-actions.ts`'s
  `startNewSeason`) rather than just setting `managed_club_id` — see
  "Season lifecycle" for what that entails and how the screen tells its
  three possible entry points apart via a `mode` search param.
  **Known simplification:** nothing stops two accounts from claiming the
  same club — `profiles` RLS is owner-read-only, so the client can't even
  see who's already claimed what. Fine for single-player use.
- `app/(tabs)/index.tsx` has a **Switch Club** action (clears
  `managed_club_id` **and** `current_season_id`, marks the abandoned
  season inactive with no final position/points since it didn't actually
  finish, returns to `/pick-club`) — added after hitting this gap live:
  there was previously no way back once a club was claimed. Distinct from
  the end-of-season "Manage a different club" offer (see "Season
  lifecycle") — this one is available anytime, mid-season, and doesn't age
  players, since a season didn't actually pass.
- Auth gating: no session → `/sign-in`; session but no `managed_club_id` →
  `/pick-club`; otherwise the `(tabs)` group. `(tabs)/_layout.tsx`
  centralizes this check once for all five tabs; `sign-in.tsx`/
  `pick-club.tsx` each do their own minimal check (redirect away if
  already satisfied).
- **Expo Router's `Tabs` navigator keeps every tab screen mounted** once
  visited — switching tabs doesn't unmount/remount, so a plain
  `useEffect(() => { load(); }, [deps])` data fetch only ever runs once
  per app session and goes stale (e.g. playing a match from the Fixtures
  tab wouldn't be reflected on the Squad/Table/Performance tabs without
  switching away and back doing nothing). All five tab screens (Squad,
  Lineup, Performance, Fixtures, Table) fetch their data inside
  `useFocusEffect(useCallback(() => {...}, [deps]))` from `expo-router`
  (re-exported from `@react-navigation/native`) instead, so returning to
  an already-mounted tab refetches. **Exception:** the lineup screen's
  *second* effect (hydrating `assignment`/`formationKey` from a saved
  lineup or auto-pick) deliberately stays a plain `useEffect` — converting
  it too would clobber an in-progress, unsaved lineup edit every time the
  manager briefly switches tabs and back.

## Season lifecycle

Three ways a manager's season can end and a new one begin — a Restart, a
natural end-of-season, or (a pre-existing feature, see above) a mid-season
Switch Club — all funnel through the same shared plumbing rather than each
reimplementing it:

- `src/lib/season.ts` — pure. `applyAgeProgression(player)`: one year of
  aging + rating progression, applied only at a genuine season rollover
  (never a Restart). Three age bands: under 24 grows toward `potential`
  (bigger steps the further below it they are, capped so nobody overshoots
  in one season), 24-29 is a player's peak (unchanged), 30+ declines,
  accelerating with age (30-32 mild, 33-35 moderate, 36+ steep, floored at
  45). The growth/decline amount is a deterministic hash of the player's
  id + new age (same approach as `ratings.ts`), not `Math.random()`, so
  rollovers stay reproducible; attributes are re-derived from the new
  overall via `ratings.ts`'s `deriveAttributes` rather than drifting
  independently. `playerSeasonReset()`/`clubSeasonReset()`: the fresh-
  season defaults every player/club is reset to at a season boundary
  (fatigue/form/injuries/suspensions/season aggregates; form_string/
  momentum/current_rating) — always applied, Restart or rollover alike.
- `src/lib/season-actions.ts` — the I/O orchestration these three flows
  share. A deliberate exception to "lib/ stays pure, I/O lives in the
  screen" (see Conventions) — this exact sequence of writes is identical
  across three different screens, so it lives once here instead of being
  copy-pasted three times. `archiveSeason` marks a season row inactive/
  ended (with a final position/points for a natural end, both null for a
  Restart, since a wipe isn't a finish). `wipeSeasonRecord` deletes a
  season's own fixtures + player_match_stats outright — Restart only; a
  natural rollover keeps them (under the now-archived season_id) for
  future career-history use. `resetLeagueState(age)` resets every player
  and club **league-wide** (this is shared league state, not just the
  manager's own squad — same reasoning as the RLS note above), aging
  everyone when `age` is true. `generateFixturesForSeason(seasonId)` runs
  `fixtures.ts`'s `generateSeasonFixtures` for every club currently in the
  league and tags every row with `seasonId`. `startNewSeason(...)` is the
  common tail all three flows call once they've archived/wiped whatever
  came before: create the season row, `resetLeagueState`, generate
  fixtures, point the profile at all of it.
- **Restart** — `app/settings.tsx`, behind a custom confirmation dialog
  (a plain themed overlay, not `Alert.alert` — react-native-web's Alert
  support isn't reliable enough to build a destructive confirmation on).
  On confirm: archives the current season (no final position/points),
  wipes its fixtures/stats, resets league state (`age: false` — a Restart
  undoes the *current* season, it isn't a season passing), clears
  `managed_club_id`/`current_season_id`, and routes to
  `/pick-club?mode=restart`. The new season (number reset to 1) and its
  fixture list aren't created until a club is actually picked there —
  `seasons.club_id` is `not null`, so there's nothing to create yet.
- **End of season** — `app/season-summary.tsx`. Reached only by
  `fixtures.tsx` routing here when a just-played round leaves no
  `scheduled` fixtures left in the season (see "Player condition & match
  performance"). The screen itself also guards the mid-season case: if its
  season still has scheduled fixtures (reached via the back button or a
  typed-in URL), it redirects to Fixtures instead of rendering the offer —
  this, not a route guard, is what keeps "no menu entry, no deep link"
  true. Shows final position/points, top scorer + player of the season
  (league-wide, via `leaders.ts`), and the manager's own club's top
  scorer/rating leader. Two paths, both archiving the season first (with
  its real final position/points this time): **"Continue with `<club>`"**
  calls `startNewSeason` directly with the same club and `age: true`, then
  returns to the Squad tab. **"Manage a different club"** clears
  `managed_club_id`/`current_season_id` and routes to
  `/pick-club?mode=new-season` — same club-selection screen as a Restart,
  but a different `mode`.
- **`app/pick-club.tsx`'s `claim()`** is the landing point for all three
  flows (plus the very first-ever club claim, which looks identical to a
  plain Switch Club to this screen — no prior seasons exist to distinguish
  it from). Reads `mode` from the URL: `'restart'` → season number 1, no
  aging; `'new-season'` → previous max season number + 1, **with** aging
  (a genuine season passed); no `mode` (first-ever claim, or the
  pre-existing mid-season Switch Club) → previous max + 1 (or 1 if none),
  no aging. Calls `startNewSeason` either way — the three cases only differ
  in `seasonNumber`/`age`, not in what happens once a club's chosen.

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
  (`000N_description.sql`). Keep each migration additive/forward-only
  rather than editing a past one, once it's been run against the real
  project. Apply one with `scripts/run-migration.ts`:
  `SUPABASE_DB_PASSWORD=... npx tsx scripts/run-migration.ts supabase/migrations/000N_x.sql`
  — the password is a discrete connection field, not embedded in a
  connection-string URL (avoids URL-encoding whatever's in it), and is
  never stored in `.env` or committed. The SQL Editor still works too, if
  preferred for a given change.
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
