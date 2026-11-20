import type { HabitColor } from './data/types';

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

/** Habit colours: fill (ring, done days), tint (card background when done), line (empty ring and
 *  done-card border), dim (partly done, always drawn with a fill-coloured outline). Ticks and text on a
 *  fill use C.bg. Contrast: C.bg on fill >= 7:1, fill on a card >= 6.7:1, line on a card >= 3:1. */
/** Neutral outline for empty controls (rings, checkboxes, grid cells): 3.8:1 on cards. */
export const CONTROL_LINE = '#76716B';
export const HABIT_COLORS: Record<HabitColor, { name: string; fill: string; tint: string; line: string; dim: string }> = {
  green: { name: 'Green', fill: '#5FD38F', tint: '#1C261E', line: '#386F4E', dim: '#2E563E' },
  violet: { name: 'Violet', fill: '#A78BFA', tint: '#231F29', line: '#695999', dim: '#473D63' },
  blue: { name: 'Blue', fill: '#7B95FF', tint: '#1E202A', line: '#5261A0', dim: '#384065' },
  amber: { name: 'Amber', fill: '#F2A93B', tint: '#2A2216', line: '#835E26', dim: '#624820' },
  pink: { name: 'Pink', fill: '#F472B6', tint: '#2A1C22', line: '#964A71', dim: '#62344B' },
  teal: { name: 'Teal', fill: '#34D3B4', tint: '#172622', line: '#236F60', dim: '#1F564B' },
};
/** Default order: a habit without a colour takes the one at its position (wrapping after 6). */
export const HABIT_COLOR_IDS: HabitColor[] = ['green', 'violet', 'blue', 'amber', 'pink', 'teal'];

/** Motion shared by the web app (CSS) and the phone (Reanimated). Everything here is skipped
 *  when the person asks for reduced motion. */
export const MOTION = {
  /** Colour and state changes (tint, border, fill). */
  fast: 150,
  /** The ring popping when a habit is logged: scale 0.85 -> 1.08 -> 1. */
  pop: { ms: 260, scales: [0.85, 1.08, 1], bezier: [0.3, 1.4, 0.6, 1] as const, css: 'cubic-bezier(0.3, 1.4, 0.6, 1)' },
  /** Toasts slide up: translateY 10px -> 0 and scale 0.98 -> 1. */
  toast: { ms: 200, fromY: 10, fromScale: 0.98, css: 'cubic-bezier(0.2, 0.8, 0.2, 1)', visibleMs: 5000, undoMs: 10000 },
  /** Drawers and sheets. */
  panel: { ms: 220, css: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
} as const;

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
