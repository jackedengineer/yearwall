import type { CatId, State } from './types';

/** The single in-memory copy of all data. Loaded from SQLite at startup;
 *  every change goes through store.ts, which writes SQLite and calls commit(). */
export const S: State = {
  meta: {
    v: 1,
    settings: { currency: '₹', monthlyTarget: 0, weeklyPostTarget: 4, tourDone: false, day0: '2026-11-17' },
    chapters: [],
    habits: [],
    plans: [],
    weeks: {},
    goals: {
      q1: { text: '', done: false },
      q2: { text: '', done: false },
      q3: { text: '', done: false },
      q4: { text: '', done: false },
    },
  },
  posts: [],
  income: [],
  logs: {},
  journal: {},
};

/** View state shared between screens (not saved). */
export const UI = {
  day: '',
  contentWeek: 0,
  chapterId: '' as string,
  bucket: 'All',
  moneyMonth: '',
  yearView: 'weeks' as 'weeks' | 'days',
  hideCats: new Set<CatId>(),
};

let version = 0;
const listeners = new Set<() => void>();

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getVersion = () => version;
/** Tell every mounted screen that data changed. */
export function commit() {
  version++;
  listeners.forEach((l) => l());
}

export const uid = (p: string) => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
