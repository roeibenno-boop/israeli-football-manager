// Starter seed data for local development / manual testing.
// Shapes match the `clubs` table in supabase/migrations/0001_init.sql.
// Not inserted automatically — copy into the Supabase SQL editor or a seed script when needed.

import type { Club } from '@/types';

export const clubsSeed: Array<Omit<Club, 'id'>> = [
  { name: 'Maccabi Tel Aviv', short_name: 'MTA', league: 'Ligat ha\'Al', budget: 25_000_000, logo_url: null },
  { name: 'Maccabi Haifa', short_name: 'MHA', league: 'Ligat ha\'Al', budget: 18_000_000, logo_url: null },
  { name: 'Hapoel Be\'er Sheva', short_name: 'HBS', league: 'Ligat ha\'Al', budget: 12_000_000, logo_url: null },
  { name: 'Hapoel Tel Aviv', short_name: 'HTA', league: 'Ligat ha\'Al', budget: 10_000_000, logo_url: null },
  { name: 'Beitar Jerusalem', short_name: 'BJR', league: 'Ligat ha\'Al', budget: 9_000_000, logo_url: null },
  { name: 'Bnei Sakhnin', short_name: 'BSA', league: 'Ligat ha\'Al', budget: 5_000_000, logo_url: null },
];
