# Israeli Football Manager

A football club management game for web and mobile, starting with the
Israeli Premier League (Ligat ha'Al). Players manage a club: squad, transfers,
finances, and fixtures against other clubs in the league.

**Status:** early. The database is seeded with the real 2026/27 Ligat ha'Al
clubs and squads (393 players, from Transfermarkt), and there's a working
auth -> pick-a-club -> view-your-squad loop. No actual game logic yet
(transfers, fixtures/results, match simulation, finances) — nothing changes
over time and nothing is simulated.

## Stack

- **Expo** (React Native) with **expo-router** (file-based routing) — SDK ~57.
- **react-native-web**, so the same codebase runs in the browser
  (`npx expo start --web`) as well as iOS/Android via Expo Go.
- **TypeScript**, strict mode.
- **Supabase** (Postgres + Auth) as the backend. Client-side access only for
  now, via `@supabase/supabase-js` and the anon key — no server/edge
  functions yet.
- Package manager: **npm**.

## Folder structure

```
app/                  Screens/routes (expo-router). File path = URL path.
                       _layout.tsx    root layout; wraps everything in AuthProvider.
                       sign-in.tsx    email/password sign in + sign up.
                       pick-club.tsx  claim an unmanaged club (sets profiles.managed_club_id).
                       index.tsx      "/" — the signed-in user's squad screen.

src/
  components/          Shared, reusable UI components (ThemedText, ThemedView, ...).
  lib/                 Non-UI helpers.
                       supabase.ts       the Supabase client.
                       auth-context.tsx  AuthProvider/useAuth — current session, via
                                         supabase.auth.onAuthStateChange.
                       use-profile.ts    useProfile(session) — loads (or creates, on
                                         first sign-in) the user's profiles row.
  types/               Shared TypeScript types (index.ts mirrors the DB schema).
  data/                Static seed data (plain data, no logic) for local dev/testing.
  constants/, hooks/   Theme tokens and small hooks (color scheme, theme lookup)
                       carried over from the Expo starter template.

supabase/
  migrations/          Hand-written SQL migrations, applied in filename order
                       (0001_init.sql, 0002_..., ...). No Supabase CLI/local
                       stack is set up yet — migrations are run manually via
                       the Supabase SQL Editor (see README.md).

assets/                App icons, splash screen, favicon.
```

Path alias: `@/*` resolves to `src/*` (see `tsconfig.json`), except
`@/assets/*` which resolves to the top-level `assets/*`.

## Database schema (supabase/migrations/0001_init.sql)

- **clubs** — `id, name, short_name, league, budget, logo_url`
- **players** — `id, club_id -> clubs, full_name, position (GK|DF|MF|FW),
  birth_date (nullable), age (nullable), market_value, weekly_wage,
  contract_until, nationality`. `age` was added in `0003` because bulk-source
  data (Transfermarkt) gives age, not exact `birth_date` — use whichever is
  populated; prefer `birth_date` when both are. `0005` adds the rating
  columns: `overall, potential` (smallint), `pace, shooting, passing,
  dribbling, defending, physical` (smallint), `preferred_foot` (left|right|
  both), `height_cm` (smallint) — all nullable until backfilled, see below.
- **fixtures** — `id, competition (league|cup), round, kickoff_at,
  home_club_id -> clubs, away_club_id -> clubs, home_goals, away_goals,
  status (scheduled|live|finished|postponed)`
- **profiles** — `id -> auth.users, display_name, managed_club_id -> clubs,
  cash_balance, created_at`

RLS: `clubs`, `players`, `fixtures` are readable by anyone (no write
policies yet — writes go through the service role / dashboard for now).
`profiles` is readable/writable only by its owner (`auth.uid() = id`).

`src/types/index.ts` mirrors these tables by hand. **When the schema
changes, update both the migration and the types together** — there's no
codegen wired up yet (Supabase can generate types from the live schema via
`supabase gen types typescript`, which would be a reasonable thing to add
once the Supabase CLI is in use).

Migrations so far: `0001` initial schema, `0002` seeds the 14 real clubs,
`0003` adds `players.age`, `0004` seeds all 393 real players, `0005` adds
the rating columns (see "Rating system" below). `0002`/`0004` were run via
direct API calls (service_role key) rather than the SQL editor — they're
kept as migration files for the record, but re-running them against a fresh
project would need the SQL editor like `0001`/`0003`/`0005` did.

## Rating system

- `src/lib/ratings.ts` — pure, deterministic functions (no I/O): given the
  same inputs they always return the same outputs. That's required for
  `scripts/backfill-ratings.ts` to be idempotent, and it's what makes the
  functions unit-testable (`src/lib/ratings.test.ts`, run via `npm test`).
  - `computeOverall(marketValueEur, age, position)` — log-scaled off market
    value, adjusted by age bracket, clamped to [45, 88]. Takes `age`, not
    `birthDate` as originally spec'd: our seeded player data is mostly
    `age` with no `birth_date` (see above), so the function matches the
    data that actually exists. Use `ageFromBirthDate()` (also exported) to
    convert when you do have a real birth date. `position` is accepted for
    interface symmetry / future tuning but unused by the current formula.
  - `computePotential(overall, age)` — younger players get a bigger
    headroom bump above `overall`. "Random" is a deterministic hash of
    `(overall, age)`, not `Math.random()` — needed for idempotency.
  - `deriveAttributes(overall, position, playerId)` — spreads
    pace/shooting/passing/dribbling/defending/physical around `overall`
    using per-position weights (e.g. a GK's shooting sits ~25 below
    overall; a FW's ~12 above), plus small variance seeded from
    `playerId` so a given player's numbers never change between runs.
  - `computeClubRating(players)` — best-11-by-overall, then
    attack/midfield/defence are that XI's FW/MF/DF group averages, and
    overall is their weighted mean (GK 15%, DF 30%, MF 30%, FW 25%). Not
    wired into any UI yet.
- `scripts/backfill-ratings.ts` — fetches every player, computes
  overall/potential/attributes, writes them back. Needs the service_role/
  secret key (RLS blocks writes to `players` for the publishable key) —
  passed as the `SUPABASE_SECRET_KEY` env var at run time, never stored in
  `.env`. Run with `SUPABASE_SECRET_KEY=sb_secret_... npm run backfill-ratings`.
  `preferred_foot`/`height_cm` aren't computed by this script — Transfermarkt's
  bulk view doesn't have them either; those columns exist for a future data
  source.
- Testing: `vitest` (devDependency) + `npm test`. Chosen over
  `jest`/`jest-expo` because `ratings.ts` is plain TS with no React Native
  dependency — vitest needs no RN-specific transform setup. Running the TS
  backfill script directly (outside Metro) uses `tsx` (devDependency).

## Auth & club-claiming flow

- `app/sign-in.tsx` → email/password via `supabase.auth.signUp` /
  `signInWithPassword`. Supabase's default "Confirm email" setting applies —
  if it's on, a new user can't sign in until they click the confirmation
  email; toggle it off in the dashboard (Authentication → Providers → Email)
  for smoother local testing.
- On first sign-in, `useProfile` creates the user's `profiles` row
  automatically (`display_name` defaults to the email's local part).
- `app/pick-club.tsx` lists all clubs and lets the user claim one
  (`profiles.managed_club_id`). **Known simplification:** nothing stops two
  accounts from claiming the same club — `profiles` RLS is owner-read-only,
  so the client can't even see who's already claimed what. Fine for
  single-player use; would need a public "claimed club ids" view/function
  (not a full profile read) before this matters for real multi-user use.
- `app/index.tsx` (the `/` route) is gated: no session → `/sign-in`; session
  but no `managed_club_id` → `/pick-club`; otherwise renders that club's
  squad. Each screen re-checks this itself (simple `<Redirect>`s) rather
  than centralizing it — there's no route-group-level guard set up yet.

## Conventions

- Screens live in `app/`; anything reusable across screens goes in `src/`.
- Env vars consumed by client code must be prefixed `EXPO_PUBLIC_` (Expo's
  convention for exposing a var to app code) — see `.env.example`.
  `src/lib/supabase.ts` reads `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/supabase.ts` does **not** throw if those env vars are missing —
  it falls back to a placeholder client and exports `isSupabaseConfigured`
  instead. Throwing at import time would crash the whole app (and break
  `expo export`'s static rendering on web) before any screen gets a chance
  to show a helpful message. Screens that need Supabase should check
  `isSupabaseConfigured` and render their own "not configured" state, the
  way `app/index.tsx` does.
- SQL migrations are plain `.sql` files, numbered sequentially
  (`000N_description.sql`), applied by hand for now. Keep each migration
  additive/forward-only rather than editing a past one, once it's been run
  against the real project.
- File/component naming follows what the Expo starter template used:
  kebab-case filenames (`themed-text.tsx`), named exports for components.

## Known non-obvious things

- This repo lives at the top level of `israeli-football-manager/`. A
  sibling folder, `אפליציית כדורגל/add ons app/`, holds a portable copy of
  Node.js (no system-wide Node install was done) plus `install_tools.bat`.
  It's local machine tooling, not project source — it's git-ignored and
  irrelevant to the app itself. If `node`/`npm` aren't on PATH in a new
  terminal, that folder needs to be added to PATH for the session (or
  install Node.js properly, system-wide).
