// No custom font file is bundled (kept dependency-free) — the "condensed,
// broadcast" feel is approximated with heavy weight + uppercase + tight
// letter-spacing on system fonts, which reads distinctly punchier than
// default-weight sentence-case text. A real condensed display font (e.g.
// Oswald/Bebas Neue) would push this further; noted as a follow-up.

import type { TextStyle } from 'react-native';

type TypeStyle = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing' | 'textTransform'>;

export const typography = {
  // Big scoreboard-style numbers (overall ratings, club rating headline).
  numericXL: { fontSize: 40, lineHeight: 42, fontWeight: '800', letterSpacing: -1 } satisfies TypeStyle,
  numericLG: { fontSize: 24, lineHeight: 26, fontWeight: '800', letterSpacing: -0.5 } satisfies TypeStyle,
  numericMD: { fontSize: 16, lineHeight: 18, fontWeight: '800', letterSpacing: -0.25 } satisfies TypeStyle,

  displayXL: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  } satisfies TypeStyle,
  displayLG: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.25,
    textTransform: 'uppercase',
  } satisfies TypeStyle,

  title: { fontSize: 17, lineHeight: 22, fontWeight: '700' } satisfies TypeStyle,
  body: { fontSize: 15, lineHeight: 20, fontWeight: '500' } satisfies TypeStyle,
  bodyBold: { fontSize: 15, lineHeight: 20, fontWeight: '700' } satisfies TypeStyle,

  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' } satisfies TypeStyle,
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TypeStyle,
} as const;
