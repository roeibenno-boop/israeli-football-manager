// Generates a full double round-robin league season from the clubs
// currently in the database and inserts it into `fixtures`. The actual
// pairing/scheduling logic lives in src/lib/fixtures.ts (pure, tested) --
// this script is just the fetch/generate/write loop, same split as
// scripts/backfill-ratings.ts.
//
// Needs a service_role/secret key (RLS blocks writes to `fixtures` for the
// anon/publishable key by design) -- pass it as an env var, never in .env.
//
// Refuses to run if league fixtures already exist, to avoid double-seeding
// a season -- pass --force to insert anyway.
//
// Usage:
//   SUPABASE_SECRET_KEY=sb_secret_... npx tsx scripts/generate-fixtures.ts [--force]

import { createClient } from '@supabase/supabase-js';

import { generateSeasonFixtures } from '../src/lib/fixtures';

function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}. ${hint}`);
  }
  return value;
}

const SUPABASE_URL = requireEnv(
  'EXPO_PUBLIC_SUPABASE_URL',
  'Already in .env — pass it inline if your shell/runner does not load .env automatically.'
);
const SECRET_KEY = requireEnv(
  'SUPABASE_SECRET_KEY',
  'Your service_role/secret key (Project Settings -> API). Never put this in .env.'
);

const supabase = createClient(SUPABASE_URL, SECRET_KEY);
const force = process.argv.includes('--force');

async function main() {
  const { count, error: countError } = await supabase
    .from('fixtures')
    .select('id', { count: 'exact', head: true })
    .eq('competition', 'league');

  if (countError) {
    console.error('Failed to check existing fixtures:', countError.message);
    process.exit(1);
  }
  if (count && count > 0 && !force) {
    console.error(
      `${count} league fixtures already exist. Refusing to double-seed the season. ` +
        'Delete them first, or re-run with --force to insert anyway.'
    );
    process.exit(1);
  }

  const { data: clubs, error: clubsError } = await supabase.from('clubs').select('id').order('name');
  if (clubsError) {
    console.error('Failed to fetch clubs:', clubsError.message);
    process.exit(1);
  }
  if (!clubs || clubs.length === 0 || clubs.length % 2 !== 0) {
    // `throw`, not `process.exit()` -- see requireEnv's comment in
    // backfill-ratings.ts for why: TS needs this branch to be recognized
    // as always-terminating to narrow `clubs` below.
    throw new Error(`Need an even, non-zero number of clubs to generate a round-robin (found ${clubs?.length ?? 0}).`);
  }

  // Next Friday at 19:00 local-ish (UTC here; good enough for a dev season).
  const seasonStart = new Date();
  seasonStart.setUTCDate(seasonStart.getUTCDate() + ((5 - seasonStart.getUTCDay() + 7) % 7 || 7));
  seasonStart.setUTCHours(19, 0, 0, 0);

  const fixtures = generateSeasonFixtures({
    clubIds: clubs.map((c) => c.id),
    seasonStart,
  });

  const { error: insertError } = await supabase.from('fixtures').insert(fixtures);
  if (insertError) {
    console.error('Failed to insert fixtures:', insertError.message);
    process.exit(1);
  }

  console.log(`Inserted ${fixtures.length} fixtures across ${fixtures.length / (clubs.length / 2)} rounds.`);
}

main();
