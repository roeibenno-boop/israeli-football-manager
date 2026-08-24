// Applies a SQL migration file directly via a Postgres connection -- for
// DDL (create/alter table), which no Supabase API key (publishable or
// service_role) can do; this or the SQL Editor are the only two ways.
//
// Needs the database password as SUPABASE_DB_PASSWORD (passed as a
// discrete connection field, not embedded in a connection-string URL --
// avoids URL-encoding whatever special characters happen to be in it).
// Never store this in .env or commit it anywhere.
//
// Usage:
//   SUPABASE_DB_PASSWORD=... npx tsx scripts/run-migration.ts supabase/migrations/0007_tactics.sql

import { readFileSync } from 'fs';
import { Client } from 'pg';

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  throw new Error('Missing SUPABASE_DB_PASSWORD.');
}

const filePath = process.argv[2];
if (!filePath) {
  throw new Error('Usage: SUPABASE_DB_PASSWORD=... npx tsx scripts/run-migration.ts <path-to-sql-file>');
}

const sql = readFileSync(filePath, 'utf8');

const client = new Client({
  host: 'db.uamwtknnyfnvdfexsoqv.supabase.co',
  port: 5432,
  user: 'postgres',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Applied ${filePath}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`Failed to apply ${filePath}:`, e instanceof Error ? e.message : e);
  process.exit(1);
});
