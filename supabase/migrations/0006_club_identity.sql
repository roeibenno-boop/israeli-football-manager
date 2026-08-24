-- 0006_club_identity.sql
-- Visual identity per club: colours + crest initials, used by
-- src/components/ClubCrest.tsx and src/theme/club-theme.tsx.
-- (Requested as 0003_club_identity.sql, but 0003 was already used --
-- renumbered to the next free slot, same as 0002/0005 before it.)

alter table public.clubs
  add column primary_colour text check (primary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  add column secondary_colour text check (secondary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  add column crest_initials text check (char_length(crest_initials) between 1 and 4);
