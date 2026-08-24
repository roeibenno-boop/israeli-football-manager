// Bundled crest images for the 14 real Ligat ha'Al clubs (see assets/crests/).
// These are the clubs' actual badges, provided locally for this app's
// internal-use-only running — not fetched/hosted by the app, and not meant
// to be redistributed. Keyed by `clubs.short_name`.
//
// Two of the fourteen were ambiguous to identify from the source filenames
// (BSA / HBS) — flagged in comments below. Swap the require() paths if
// they're backwards.

import type { ImageSourcePropType } from 'react-native';

export const clubCrestImages: Record<string, ImageSourcePropType> = {
  MTA: require('../../assets/crests/mta.png'), // Maccabi Tel Aviv
  MHA: require('../../assets/crests/mha.png'), // Maccabi Haifa
  MNE: require('../../assets/crests/mne.png'), // Maccabi Netanya
  MPT: require('../../assets/crests/mpt.png'), // Maccabi Petah Tikva
  HHA: require('../../assets/crests/hha.png'), // Hapoel Haifa
  HJR: require('../../assets/crests/hjr.png'), // Hapoel Jerusalem
  HPT: require('../../assets/crests/hpt.png'), // Hapoel Petah Tikva
  HTA: require('../../assets/crests/hta.png'), // Hapoel Tel Aviv
  HRG: require('../../assets/crests/hrg.png'), // Hapoel Ramat Gan
  BJR: require('../../assets/crests/bjr.png'), // Beitar Jerusalem
  IKS: require('../../assets/crests/iks.png'), // Ironi Kiryat Shmona
  ITB: require('../../assets/crests/itb.webp'), // Ironi Tiberias
  BSA: require('../../assets/crests/bsa.png'), // Ihud Bnei Sakhnin -- unconfirmed, see above
  HBS: require('../../assets/crests/hbs.png'), // Hapoel Be'er Sheva -- unconfirmed, see above
};
