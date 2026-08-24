// Real Ligat ha'Al (Israeli Premier League) clubs, 2026/27 season.
// Source: https://www.transfermarkt.us/ligat-haal/startseite/wettbewerb/ISR1
// Shapes match the `clubs` table in supabase/migrations/0001_init.sql.
// The actual insert lives in supabase/migrations/0002_seed_clubs.sql — this file
// is for local reference / reuse in app code (e.g. a future admin/seed script).
// `budget`, `logo_url`, and the visual-identity fields (0006_club_identity.sql)
// are game/design fields, not sourced from Transfermarkt — left at defaults.

import type { Club } from '@/types';

const visualDefaults = { primary_colour: null, secondary_colour: null, crest_initials: null } as const;

export const clubsSeed: Array<Omit<Club, 'id'>> = [
  { name: 'Maccabi Tel Aviv', short_name: 'MTA', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Maccabi Haifa', short_name: 'MHA', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: "Hapoel Be'er Sheva", short_name: 'HBS', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Hapoel Tel Aviv', short_name: 'HTA', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Beitar Jerusalem', short_name: 'BJR', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Maccabi Netanya', short_name: 'MNE', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Ironi Kiryat Shmona', short_name: 'IKS', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Maccabi Petah Tikva', short_name: 'MPT', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Hapoel Jerusalem', short_name: 'HJR', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Hapoel Petah Tikva', short_name: 'HPT', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Hapoel Ramat Gan', short_name: 'HRG', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Ihud Bnei Sakhnin', short_name: 'BSA', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Ironi Tiberias', short_name: 'ITB', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
  { name: 'Hapoel Haifa', short_name: 'HHA', league: "Ligat ha'Al", budget: 0, logo_url: null, ...visualDefaults },
];
