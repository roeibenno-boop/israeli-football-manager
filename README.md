# Israeli Football Manager

A football club management game for web and mobile, starting with the
Israeli Premier League (Ligat ha'Al). Manage a club: squad, tactics,
fixtures, and league progression.

**Status:** the core gameplay loop works end to end — auth → pick a club →
view your real squad → build a lineup → play matches (simulated, with full
per-player stats/ratings) → watch fatigue/form/injuries evolve and the
league table update. Still missing: transfers, finances, and a cup
competition.

## Stack

- [Expo](https://expo.dev) (React Native) with [expo-router](https://docs.expo.dev/router/introduction/) (file-based routing) — SDK ~57.
- **react-native-web**, so the same codebase runs in the browser (`npx expo start --web`) as well as iOS/Android via Expo Go.
- **TypeScript**, strict mode.
- [Supabase](https://supabase.com) (Postgres + Auth) as the backend, via `@supabase/supabase-js`.
- **react-native-svg** for generated crests and the lineup pitch markings.
- **react-native-reanimated** for press feedback / entrance / sheet transitions.
- Package manager: **npm**. Testing: **vitest**. Running standalone TS scripts: **tsx**.

## Feature set

- **Auth & club claiming** — email/password sign-in, then claim one of the
  14 real Ligat ha'Al clubs to manage.
- **Squad** — your real, rated squad (attributes derived from real market
  values via a deterministic rating engine), sortable/filterable, with
  fatigue-aware overall ratings.
- **Lineup** — pick a formation, build a starting XI on an interactive
  pitch, auto-pick a best XI, see a live fatigue/out-of-position-adjusted
  club rating before you save.
- **Fixtures & match simulation** — a full 26-round double round-robin
  season; "Play Next Match" runs an entire round through a seeded match
  engine (an exact closed-form Davidson outcome model — see
  `src/lib/matchOdds.ts`), generating a scoreline, match events, and a full
  per-player stat line for everyone who played.
- **Player condition** — fatigue, rolling match form, injuries, and
  suspensions all evolve match to match and feed back into future team
  strength.
- **Performance & league table** — season leaderboards (goals, assists,
  ratings, clean sheets, cards) and a live standings table, both driven off
  real per-match stats rather than a shortcut aggregate.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture writeup — folder
structure, database schema, and the reasoning behind every subsystem.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) (a recent LTS release)
- A [Supabase](https://supabase.com) project (free tier is fine)

### Install

```bash
npm install
```

### Configure environment variables

Copy the example file and fill in your own Supabase project's values (find
both under Supabase dashboard → Project Settings → API):

```bash
cp .env.example .env
```

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

`.env` is git-ignored — never commit real values. Variables must be
prefixed `EXPO_PUBLIC_` for Expo to expose them to app code.

### Set up the database

Apply the SQL migrations in `supabase/migrations/`, in filename order,
against your Supabase project (via the SQL Editor, or
`scripts/run-migration.ts` if you have direct Postgres access —
see that script's header comment for usage). Then seed clubs/players and
generate a season's fixtures — the seed migrations and
`scripts/generate-fixtures.ts` need your project's `service_role`/secret
key, passed only as an env var, never stored in `.env`:

```bash
SUPABASE_SECRET_KEY=your-service-role-key npx tsx scripts/generate-fixtures.ts
```

### Run it

```bash
npx expo start --web   # or: npm run web
```

Or scan the QR code with Expo Go for iOS/Android.

### Run tests

```bash
npm test
```

## Project structure

```
app/            Screens (expo-router file-based routing)
src/
  components/   Shared UI components
  theme/        Dark-only design tokens + club colour theming
  lib/          Pure business logic (ratings, fixtures, simulation, standings, ...)
  types/        Shared TypeScript types mirroring the DB schema
  data/         Static seed data
scripts/        Standalone admin scripts (run via tsx)
supabase/
  migrations/   Hand-written, sequentially numbered SQL migrations
```

Full details in [`CLAUDE.md`](./CLAUDE.md).

## A note on club crests

`assets/crests/` (real club crest images) is intentionally not included in
this repository — see `CLAUDE.md`'s "Visual identity" section. Without it,
the app renders generated placeholder crests (a shield in each club's two
colours) instead of the real badges; everything else works normally.
