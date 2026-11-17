/**
 * Every change to data goes through these actions: update the in-memory
 * state, write the matching SQLite rows, then commit() so screens re-render.
 */
import { allKeys, keyOf, logId, type Kind, type Rec } from './records';
import * as repo from './repo';
import { commit, S, uid } from './state';
import { buildTemplate } from './template';
import type { Chapter, GoalKey, Habit, Income, JournalEntry, Plan, Post, Settings, State, Test } from './types';
import { monKey } from '../utils/dates';

/** Where actions save data. The phone uses SQLite (repo.ts); the web app keeps data in memory only. */
export type Persist = Pick<
  typeof repo,
  | 'batch'
  | 'setLog'
  | 'saveHabit'
  | 'deleteHabit'
  | 'saveJournal'
  | 'savePlan'
  | 'deletePlan'
  | 'saveWeek'
  | 'saveGoal'
  | 'saveChapter'
  | 'deleteChapter'
  | 'savePost'
  | 'deletePost'
  | 'saveIncome'
  | 'deleteIncome'
  | 'saveSettings'
  | 'replaceAll'
  | 'loadAll'
>;
let P: Persist = repo;

/** Called with every record an action changes, so sync can send it. */
let onTouch: ((k: Kind, i: string) => void) | null = null;
export const setTouchHandler = (fn: ((k: Kind, i: string) => void) | null) => {
  onTouch = fn;
};
const touch = (k: Kind, i: string) => onTouch?.(k, i);

function assign(st: State) {
  S.meta = st.meta;
  S.posts = st.posts;
  S.income = st.income;
  S.logs = st.logs;
  S.journal = st.journal;
}

/** Opens the database, creates tables, and loads everything into memory. First run writes the Chapter 1 plan. */
export function initStore(db: repo.Db) {
  P = repo;
  repo.setDb(db);
  repo.migrate();
  const st = repo.loadAll();
  if (st) assign(st);
  else {
    const t = buildTemplate();
    repo.replaceAll(t);
    assign(repo.loadAll() ?? t);
  }
  commit();
}

/** Web app: no local database. Data arrives from the server, so start empty instead of with the template. */
export function initMemoryStore() {
  const noop = () => {};
  P = {
    batch: (fn: () => void) => fn(),
    setLog: noop,
    saveHabit: noop,
    deleteHabit: noop,
    saveJournal: noop,
    savePlan: noop,
    deletePlan: noop,
    saveWeek: noop,
    saveGoal: noop,
    saveChapter: noop,
    deleteChapter: noop,
    savePost: noop,
    deletePost: noop,
    saveIncome: noop,
    deleteIncome: noop,
    saveSettings: noop,
    replaceAll: noop,
    loadAll: () => null,
  };
  commit();
}

/** Fills an empty app with the Chapter 1 plan and marks all of it for syncing (web app with an empty server). */
export function seedTemplate() {
  const t = buildTemplate();
  P.replaceAll(t);
  assign(t);
  allKeys().forEach((key) => touch(key.k, key.i));
  commit();
}

/** Applies records that came from the server. Does not mark them for sending back. */
export function applyRemote(recs: Rec[]) {
  if (!recs.length) return;
  let habitsChanged = false;
  P.batch(() => {
    for (const r of recs) {
      const { k, i, d } = r;
      switch (k) {
        case 'settings':
          if (d) {
            S.meta.settings = { ...S.meta.settings, ...d };
            P.saveSettings(S.meta.settings);
          }
          break;
        case 'chapter':
          S.meta.chapters = upsert(S.meta.chapters, i, d);
          if (d) P.saveChapter(d);
          else P.deleteChapter(i);
          break;
        case 'habit': {
          const rest = S.meta.habits.filter((h) => h.id !== i);
          if (d) {
            const { sort, ...h } = d;
            const at = Math.max(0, Math.min(typeof sort === 'number' ? sort : rest.length, rest.length));
            rest.splice(at, 0, h as Habit);
          } else P.deleteHabit(i);
          S.meta.habits = rest;
          habitsChanged = true;
          break;
        }
        case 'plan':
          S.meta.plans = upsert(S.meta.plans, i, d);
          if (d) P.savePlan(d);
          else P.deletePlan(i);
          break;
        case 'week': {
          const weeks = { ...S.meta.weeks };
          if (d) weeks[i] = d;
          else delete weeks[i];
          S.meta.weeks = weeks;
          P.saveWeek(Number(i), d ?? {});
          break;
        }
        case 'goal': {
          const g = d ?? { text: '', done: false };
          S.meta.goals = { ...S.meta.goals, [i]: g };
          P.saveGoal(Number(i.slice(1)), g.text || '', !!g.done);
          break;
        }
        case 'post':
          S.posts = upsert(S.posts, i, d);
          if (d) P.savePost(d);
          else P.deletePost(i);
          break;
        case 'income':
          S.income = upsert(S.income, i, d);
          if (d) P.saveIncome(d);
          else P.deleteIncome(i);
          break;
        case 'log': {
          const [date, hid] = i.split('|');
          const m = monKey(date);
          const day = { ...(S.logs[m]?.[date] || {}) };
          if (d && d.v > 0) day[hid] = Math.round(d.v);
          else delete day[hid];
          S.logs[m] = { ...(S.logs[m] || {}), [date]: day };
          P.setLog(date, hid, d?.v ?? 0);
          break;
        }
        case 'journal': {
          const m = monKey(i);
          const days = { ...(S.journal[m] || {}) };
          if (d) days[i] = d;
          else delete days[i];
          S.journal[m] = days;
          P.saveJournal(i, d ?? {});
          break;
        }
      }
    }
    if (habitsChanged) S.meta.habits.forEach((h, n) => P.saveHabit(h, n));
  });
  commit();
}

function upsert<T extends { id: string }>(list: T[], id: string, item: T | null): T[] {
  if (!item) return list.filter((x) => x.id !== id);
  return list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? item : x)) : [...list, item];
}

export function normalizeState(raw: any): State {
  if (!raw || !raw.meta || !Array.isArray(raw.meta.chapters)) throw new Error('Not a Year Wall backup');
  const t = buildTemplate();
  const meta = raw.meta;
  return {
    meta: {
      v: 1,
      settings: { ...t.meta.settings, ...(meta.settings || {}) },
      chapters: (meta.chapters || []).map((c: any) => ({ ...c, tests: c.tests || [], phases: c.phases || [] })),
      habits: (meta.habits || []).map((h: any) => ({ step: 5, daysPerWeek: 7, pauses: [], targets: [{ from: h.activeFrom, value: 1 }], ...h })),
      plans: meta.plans || [],
      weeks: meta.weeks || {},
      goals: { ...t.meta.goals, ...(meta.goals || {}) },
    },
    posts: raw.posts || [],
    income: (raw.income || []).map((i: any) => ({ ...i, amount: Number(i.amount) || 0 })),
    logs: raw.logs || {},
    journal: raw.journal || {},
  };
}

export const actions = {
  /* habits */
  setValue(h: Habit, d: string, v: number) {
    const m = monKey(d);
    const day = { ...(S.logs[m]?.[d] || {}) };
    if (v > 0) day[h.id] = Math.round(v);
    else delete day[h.id];
    S.logs[m] = { ...(S.logs[m] || {}), [d]: day };
    P.setLog(d, h.id, v);
    touch('log', logId(d, h.id));
    commit();
  },
  saveHabit(h: Habit) {
    const i = S.meta.habits.findIndex((x) => x.id === h.id);
    if (i >= 0) S.meta.habits[i] = h;
    else S.meta.habits.push(h);
    S.meta.habits = [...S.meta.habits];
    P.saveHabit(h, S.meta.habits.findIndex((x) => x.id === h.id));
    touch('habit', h.id);
    commit();
  },
  deleteHabit(id: string) {
    S.meta.habits = S.meta.habits.filter((h) => h.id !== id);
    P.deleteHabit(id);
    touch('habit', id);
    // Later habits move up one place, so their order changes too.
    S.meta.habits.forEach((h, i) => {
      P.saveHabit(h, i);
      touch('habit', h.id);
    });
    commit();
  },

  /* journal */
  saveJournal(d: string, patch: Partial<JournalEntry>, silent = false) {
    const m = monKey(d);
    const entry = { ...(S.journal[m]?.[d] || {}), ...patch };
    S.journal[m] = { ...(S.journal[m] || {}), [d]: entry };
    P.saveJournal(d, entry);
    touch('journal', d);
    if (!silent) commit();
  },

  /* plans */
  savePlan(p: Plan) {
    if (p.end < p.start) [p.start, p.end] = [p.end, p.start];
    const i = S.meta.plans.findIndex((x) => x.id === p.id);
    S.meta.plans = i >= 0 ? S.meta.plans.map((x) => (x.id === p.id ? p : x)) : [...S.meta.plans, p];
    P.savePlan(p);
    touch('plan', p.id);
    commit();
  },
  addPlan(title: string, start: string, end: string, cat: Plan['cat']) {
    actions.savePlan({ id: uid('pl'), title, start, end, cat });
  },
  deletePlan(id: string) {
    S.meta.plans = S.meta.plans.filter((p) => p.id !== id);
    P.deletePlan(id);
    touch('plan', id);
    commit();
  },

  /* weeks + goals */
  saveWeek(w: number, patch: { focus?: string; notes?: string }, silent = false) {
    const info = { ...(S.meta.weeks[String(w)] || {}), ...patch };
    S.meta.weeks = { ...S.meta.weeks, [String(w)]: info };
    P.saveWeek(w, info);
    touch('week', String(w));
    if (!silent) commit();
  },
  saveGoal(q: 1 | 2 | 3 | 4, patch: { text?: string; done?: boolean }, silent = false) {
    const key = `q${q}` as GoalKey;
    const g = { ...S.meta.goals[key], ...patch };
    S.meta.goals = { ...S.meta.goals, [key]: g };
    P.saveGoal(q, g.text, g.done);
    touch('goal', key);
    if (!silent) commit();
  },

  /* chapters + tests */
  saveChapter(c: Chapter) {
    if (c.end < c.start) [c.start, c.end] = [c.end, c.start];
    const i = S.meta.chapters.findIndex((x) => x.id === c.id);
    S.meta.chapters = i >= 0 ? S.meta.chapters.map((x) => (x.id === c.id ? c : x)) : [...S.meta.chapters, c];
    P.saveChapter(c);
    touch('chapter', c.id);
    commit();
  },
  deleteChapter(id: string) {
    S.meta.chapters = S.meta.chapters.filter((c) => c.id !== id);
    P.deleteChapter(id);
    touch('chapter', id);
    commit();
  },
  saveTest(chapterId: string, t: Test) {
    const c = S.meta.chapters.find((x) => x.id === chapterId);
    if (!c) return;
    const tests = c.tests.some((x) => x.id === t.id) ? c.tests.map((x) => (x.id === t.id ? t : x)) : [...c.tests, t];
    actions.saveChapter({ ...c, tests });
  },
  deleteTest(chapterId: string, testId: string) {
    const c = S.meta.chapters.find((x) => x.id === chapterId);
    if (!c) return;
    actions.saveChapter({ ...c, tests: c.tests.filter((x) => x.id !== testId) });
  },

  /* posts */
  savePost(p: Post) {
    const i = S.posts.findIndex((x) => x.id === p.id);
    S.posts = i >= 0 ? S.posts.map((x) => (x.id === p.id ? p : x)) : [...S.posts, p];
    P.savePost(p);
    touch('post', p.id);
    commit();
  },
  deletePost(id: string) {
    S.posts = S.posts.filter((p) => p.id !== id);
    P.deletePost(id);
    touch('post', id);
    commit();
  },

  /* income */
  saveIncome(e: Income) {
    const i = S.income.findIndex((x) => x.id === e.id);
    S.income = i >= 0 ? S.income.map((x) => (x.id === e.id ? e : x)) : [...S.income, e];
    P.saveIncome(e);
    touch('income', e.id);
    commit();
  },
  deleteIncome(id: string) {
    S.income = S.income.filter((x) => x.id !== id);
    P.deleteIncome(id);
    touch('income', id);
    commit();
  },

  /* settings */
  saveSettings(patch: Partial<Settings>, silent = false) {
    S.meta.settings = { ...S.meta.settings, ...patch };
    P.saveSettings(S.meta.settings);
    touch('settings', 'settings');
    if (!silent) commit();
  },

  /* backup */
  exportJson() {
    return JSON.stringify({ app: 'yearwall', exportedAt: new Date().toISOString(), ...S }, null, 2);
  },
  importJson(text: string) {
    const st = normalizeState(JSON.parse(text));
    // Everything that existed before or exists now has changed, so all of it syncs (removed records sync as deletions).
    const keys = new Map(allKeys().map((x) => [keyOf(x.k, x.i), x]));
    P.replaceAll(st);
    assign(P.loadAll() ?? st);
    allKeys().forEach((x) => keys.set(keyOf(x.k, x.i), x));
    keys.forEach((x) => touch(x.k, x.i));
    commit();
  },
};

export { uid };
