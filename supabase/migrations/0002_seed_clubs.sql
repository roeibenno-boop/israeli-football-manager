-- 0002_seed_clubs.sql
-- Seed the real Ligat ha'Al (Israeli Premier League) clubs, 2026/27 season.
-- Source: https://www.transfermarkt.us/ligat-haal/startseite/wettbewerb/ISR1
-- budget/logo_url are game fields, not sourced from Transfermarkt — left at defaults.
--
-- Run once. Re-running will insert duplicate rows (no unique constraint on
-- name yet) — if you need to re-seed, delete the existing rows first.

insert into public.clubs (name, short_name, league) values
  ('Maccabi Tel Aviv',       'MTA', 'Ligat ha''Al'),
  ('Maccabi Haifa',          'MHA', 'Ligat ha''Al'),
  ('Hapoel Be''er Sheva',    'HBS', 'Ligat ha''Al'),
  ('Hapoel Tel Aviv',        'HTA', 'Ligat ha''Al'),
  ('Beitar Jerusalem',       'BJR', 'Ligat ha''Al'),
  ('Maccabi Netanya',        'MNE', 'Ligat ha''Al'),
  ('Ironi Kiryat Shmona',    'IKS', 'Ligat ha''Al'),
  ('Maccabi Petah Tikva',    'MPT', 'Ligat ha''Al'),
  ('Hapoel Jerusalem',       'HJR', 'Ligat ha''Al'),
  ('Hapoel Petah Tikva',     'HPT', 'Ligat ha''Al'),
  ('Hapoel Ramat Gan',       'HRG', 'Ligat ha''Al'),
  ('Ihud Bnei Sakhnin',      'BSA', 'Ligat ha''Al'),
  ('Ironi Tiberias',         'ITB', 'Ligat ha''Al'),
  ('Hapoel Haifa',           'HHA', 'Ligat ha''Al');
