// Computes overall/potential/attributes for every player and writes them
// back to Supabase. All the math lives in src/lib/ratings.ts (pure,
// deterministic) — this script is just the fetch/compute/write loop.
// Idempotent: since the rating functions are deterministic, re-running this
// recomputes the exact same values from the same inputs and rewrites them —
// safe to run as often as you like.
//
// RLS blocks writes to `players` for the anon/publishable key by design, so
// this needs a service_role/secret key. Pass it as an env var — do NOT put
// it in .env under an EXPO_PUBLIC_ name, that would ship it to client
// bundles, and do NOT commit it anywhere.
//
// Usage (from the project root):
//   SUPABASE_SECRET_KEY=sb_secret_... npx tsx scripts/backfill-ratings.ts

import { createClient } from '@supabase/supabase-js';

import { computeOverall, computePotential, deriveAttributes, ageFromBirthDate } from '../src/lib/ratings';
import type { PlayerPosition } from '../src/types';

function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    // `throw`, not `process.exit()` -- TS recognizes `throw` as always
    // terminating (needed to narrow the return type to `string` below)
    // regardless of whether @types/node's `process.exit(): never` is
    // resolved correctly in this project's tsconfig.
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
  'Your service_role/secret key (Project Settings -> API). Never put this in .env. ' +
    'Example: SUPABASE_SECRET_KEY=sb_secret_... npx tsx scripts/backfill-ratings.ts'
);

const supabase = createClient(SUPABASE_URL, SECRET_KEY);

type PlayerRow = {
  id: string;
  position: PlayerPosition;
  birth_date: string | null;
  age: number | null;
  market_value: number;
};

function resolveAge(player: PlayerRow): number | null {
  if (player.age != null) return player.age;
  if (player.birth_date) return ageFromBirthDate(player.birth_date);
  return null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function main() {
  const { data: players, error } = await supabase
    .from('players')
    .select('id, position, birth_date, age, market_value');

  if (error) {
    console.error('Failed to fetch players:', error.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const batch of chunk(players ?? [], 20)) {
    await Promise.all(
      batch.map(async (player: PlayerRow) => {
        const age = resolveAge(player);
        if (age == null) {
          skipped += 1;
          console.warn(`Skipping ${player.id}: no age or birth_date on file.`);
          return;
        }

        const overall = computeOverall(player.market_value, age, player.position);
        const potential = computePotential(overall, age);
        const attributes = deriveAttributes(overall, player.position, player.id);

        const { error: updateError } = await supabase
          .from('players')
          .update({ overall, potential, ...attributes })
          .eq('id', player.id);

        if (updateError) {
          failed += 1;
          console.error(`Failed to update ${player.id}: ${updateError.message}`);
        } else {
          updated += 1;
        }
      })
    );
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped} (no age), failed ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main();
