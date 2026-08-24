// Bundled crest images for the 14 real Ligat ha'Al clubs. Keyed by
// `clubs.short_name`.
//
// This file is intentionally checked into git as an EMPTY stub -- the real
// crest artwork (assets/crests/) is user-supplied for local/internal-use-only
// running and is deliberately excluded from the public repo (real clubs'
// trademarked badges, not cleared for redistribution; see .gitignore and
// CLAUDE.md's "Visual identity" section). With no entries here,
// ClubCrest.tsx's fallback (a generated placeholder shield from the club's
// two colours + initials) renders for every club -- the app builds and runs
// completely fine without the real images.
//
// react-native/Metro requires image `require()` paths to be static and
// resolvable at bundle time, so this can't dynamically check "does the file
// exist" -- a require() pointing at a missing file fails the whole bundle,
// not just that one crest. That's why the real, filled-in version of this
// file (which does `require('../../assets/crests/xyz.png')` per club, same
// shape as below) lives ONLY on disk locally, never committed:
// `git update-index --skip-worktree src/components/club-crest-images.ts`
// has been run so git treats local edits to this exact file as
// intentionally untracked (`git status` stays clean even though the local
// copy differs from what's committed here). If you're setting this up
// fresh with your own licensed/cleared crest images, drop them in
// assets/crests/ and fill in the map below locally, e.g.:
//
//   MTA: require('../../assets/crests/mta.png'), // Maccabi Tel Aviv
//
// (run `git update-index --skip-worktree` on this file again afterwards so
// your local version doesn't get committed).

import type { ImageSourcePropType } from 'react-native';

export const clubCrestImages: Record<string, ImageSourcePropType> = {};
