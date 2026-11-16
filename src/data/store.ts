/**
 * Every change to data goes through these actions: update the in-memory
 * state, write the matching SQLite rows, then commit() so screens re-render.
 */
import * as repo from './repo';
import { commit, S, uid } from './state';
import { buildTemplate } from './template';
import type { Chapter, GoalKey, Habit, Income, JournalEntry, Plan, Post, Settings, State, Test } from './types';
import { monKey } from '../utils/dates';

function assign(st: State) {
  S.meta = st.meta;
  S.posts = st.posts;
  S.income = st.income;
  S.logs = st.logs;
  S.journal = st.journal;
}

/** Opens the database, creates tables, and loads everything into memory. First run writes the Chapter 1 plan. */
export function initStore(db: repo.Db) {
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
    repo.setLog(d, h.id, v);
    commit();
  },
  saveHabit(h: Habit) {
    const i = S.meta.habits.findIndex((x) => x.id === h.id);
    if (i >= 0) S.meta.habits[i] = h;
    else S.meta.habits.push(h);
    S.meta.habits = [...S.meta.habits];
    repo.saveHabit(h, S.meta.habits.findIndex((x) => x.id === h.id));
    commit();
  },
  deleteHabit(id: string) {
    S.meta.habits = S.meta.habits.filter((h) => h.id !== id);
    repo.deleteHabit(id);
    S.meta.habits.forEach((h, i) => repo.saveHabit(h, i));
    commit();
  },

  /* journal */
  saveJournal(d: string, patch: Partial<JournalEntry>, silent = false) {
    const m = monKey(d);
    const entry = { ...(S.journal[m]?.[d] || {}), ...patch };
    S.journal[m] = { ...(S.journal[m] || {}), [d]: entry };
    repo.saveJournal(d, entry);
    if (!silent) commit();
  },

  /* plans */
  savePlan(p: Plan) {
    if (p.end < p.start) [p.start, p.end] = [p.end, p.start];
    const i = S.meta.plans.findIndex((x) => x.id === p.id);
    S.meta.plans = i >= 0 ? S.meta.plans.map((x) => (x.id === p.id ? p : x)) : [...S.meta.plans, p];
    repo.savePlan(p);
    commit();
  },
  addPlan(title: string, start: string, end: string, cat: Plan['cat']) {
    actions.savePlan({ id: uid('pl'), title, start, end, cat });
  },
  deletePlan(id: string) {
    S.meta.plans = S.meta.plans.filter((p) => p.id !== id);
    repo.deletePlan(id);
    commit();
  },

  /* weeks + goals */
  saveWeek(w: number, patch: { focus?: string; notes?: string }, silent = false) {
    const info = { ...(S.meta.weeks[String(w)] || {}), ...patch };
    S.meta.weeks = { ...S.meta.weeks, [String(w)]: info };
    repo.saveWeek(w, info);
    if (!silent) commit();
  },
  saveGoal(q: 1 | 2 | 3 | 4, patch: { text?: string; done?: boolean }, silent = false) {
    const key = `q${q}` as GoalKey;
    const g = { ...S.meta.goals[key], ...patch };
    S.meta.goals = { ...S.meta.goals, [key]: g };
    repo.saveGoal(q, g.text, g.done);
    if (!silent) commit();
  },

  /* chapters + tests */
  saveChapter(c: Chapter) {
    if (c.end < c.start) [c.start, c.end] = [c.end, c.start];
    const i = S.meta.chapters.findIndex((x) => x.id === c.id);
    S.meta.chapters = i >= 0 ? S.meta.chapters.map((x) => (x.id === c.id ? c : x)) : [...S.meta.chapters, c];
    repo.saveChapter(c);
    commit();
  },
  deleteChapter(id: string) {
    S.meta.chapters = S.meta.chapters.filter((c) => c.id !== id);
    repo.deleteChapter(id);
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
    repo.savePost(p);
    commit();
  },
  deletePost(id: string) {
    S.posts = S.posts.filter((p) => p.id !== id);
    repo.deletePost(id);
    commit();
  },

  /* income */
  saveIncome(e: Income) {
    const i = S.income.findIndex((x) => x.id === e.id);
    S.income = i >= 0 ? S.income.map((x) => (x.id === e.id ? e : x)) : [...S.income, e];
    repo.saveIncome(e);
    commit();
  },
  deleteIncome(id: string) {
    S.income = S.income.filter((x) => x.id !== id);
    repo.deleteIncome(id);
    commit();
  },

  /* settings */
  saveSettings(patch: Partial<Settings>, silent = false) {
    S.meta.settings = { ...S.meta.settings, ...patch };
    repo.saveSettings(S.meta.settings);
    if (!silent) commit();
  },

  /* backup */
  exportJson() {
    return JSON.stringify({ app: 'yearwall', exportedAt: new Date().toISOString(), ...S }, null, 2);
  },
  importJson(text: string) {
    const st = normalizeState(JSON.parse(text));
    repo.replaceAll(st);
    assign(repo.loadAll() ?? st);
    commit();
  },
};

export { uid };
