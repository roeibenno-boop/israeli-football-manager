# Israeli Football Manager

A football club management game for web and mobile, starting with the
Israeli Premier League (Ligat ha'Al). Players manage a club: squad, transfers,
finances, and fixtures against other clubs in the league.

**Status:** project foundation only. No game logic (transfers, standings,
match simulation, etc.) has been built yet — this repo currently just proves
the app boots on web + mobile and can read/write Supabase.

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
                       app/_layout.tsx is the root layout (wraps every screen).
                       app/index.tsx is the "/" route (currently the clubs list).

src/
  components/          Shared, reusable UI components (ThemedText, ThemedView, ...).
  lib/                 Non-UI helpers. lib/supabase.ts is the Supabase client.
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
  birth_date, market_value, weekly_wage, contract_until, nationality`
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
