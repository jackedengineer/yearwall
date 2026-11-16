export const C = {
  bg: '#090807',
  s1: '#121110',
  s2: '#141312',
  s3: '#1A1817',
  s4: '#1E1C1A',
  line: '#2A2725',
  line2: '#221F1D',
  line3: '#33302D',
  tx: '#F4F1EC',
  tx2: '#C9C4BE',
  mut: '#9A958F',
  mut2: '#8A847E',
  lit: '#ECE8E2',
  mid: '#5C5853',
  off: '#24211F',
  fut: '#171514',
  ok: '#86E2AE',
  okBg: '#0F1F16',
  okLine: '#1F4430',
  perfect: '#2F7A50',
  amberBg: '#1F1A14',
  amberLine: '#3A2F22',
  amberTx: '#F2D3A8',
  danger: '#F2A3A3',
  dangerBg: '#1C1212',
  dangerLine: '#4A2A2A',
};

export type Weight = 400 | 500 | 600 | 700;

export const FONT_FILES = {
  400: 'Montserrat_400Regular',
  500: 'Montserrat_500Medium',
  600: 'Montserrat_600SemiBold',
  700: 'Montserrat_700Bold',
} as const;

let fontsReady = false;
export const setFontsReady = (v: boolean) => {
  fontsReady = v;
};

/** fontFamily when Montserrat loaded, otherwise the system font at the same weight. */
export function font(w: Weight) {
  return fontsReady ? { fontFamily: FONT_FILES[w] } : { fontWeight: String(w) as '400' | '500' | '600' | '700' };
}
