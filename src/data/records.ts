/**
 * Sync records: the unit that moves between devices and the server.
 * Each record is one thing a person edits as a whole (a plan, a habit with its
 * targets, one day's log for one habit, ...). The server only stores records
 * as JSON, so it never needs to change when the app's data shape does.
 *
 * Pure TypeScript: shared by the phone app, the web app and the tests.
 */
import { monKey } from '../utils/dates';
import { S } from './state';
import type { GoalKey, State } from './types';

export type Kind = 'settings' | 'chapter' | 'habit' | 'plan' | 'week' | 'goal' | 'post' | 'income' | 'log' | 'journal';
export const KINDS: Kind[] = ['settings', 'chapter', 'habit', 'plan', 'week', 'goal', 'post', 'income', 'log', 'journal'];

/** What goes over the wire. d = null means the record was deleted. u = when it was last edited (ms). */
export type Rec = { k: Kind; i: string; d: any | null; u: number };
export type Key = { k: Kind; i: string };

export const keyOf = (k: Kind, i: string) => `${k}:${i}`;
export const logId = (date: string, habitId: string) => `${date}|${habitId}`;

const GOALS: GoalKey[] = ['q1', 'q2', 'q3', 'q4'];
const journalEmpty = (j: { text?: string; feynman?: string; energy?: number | null }) =>
  !(j.text || '').trim() && !(j.feynman || '').trim() && !j.energy;

/** The current data for one record, or null if it no longer exists. */
export function readRecord(k: Kind, i: string, st: State = S): any | null {
  switch (k) {
    case 'settings':
      return st.meta.settings;
    case 'chapter':
      return st.meta.chapters.find((c) => c.id === i) ?? null;
    case 'habit': {
      const sort = st.meta.habits.findIndex((h) => h.id === i);
      return sort < 0 ? null : { ...st.meta.habits[sort], sort };
    }
    case 'plan':
      return st.meta.plans.find((p) => p.id === i) ?? null;
    case 'week': {
      const w = st.meta.weeks[i];
      return w && (w.focus || w.notes) ? w : null;
    }
    case 'goal':
      return st.meta.goals[i as GoalKey] ?? null;
    case 'post':
      return st.posts.find((p) => p.id === i) ?? null;
    case 'income':
      return st.income.find((x) => x.id === i) ?? null;
    case 'log': {
      const [date, hid] = i.split('|');
      const v = st.logs[monKey(date)]?.[date]?.[hid];
      return v && v > 0 ? { v } : null;
    }
    case 'journal': {
      const j = st.journal[monKey(i)]?.[i];
      return j && !journalEmpty(j) ? j : null;
    }
  }
}

/** Every record that currently exists. */
export function allKeys(st: State = S): Key[] {
  const out: Key[] = [{ k: 'settings', i: 'settings' }];
  st.meta.chapters.forEach((c) => out.push({ k: 'chapter', i: c.id }));
  st.meta.habits.forEach((h) => out.push({ k: 'habit', i: h.id }));
  st.meta.plans.forEach((p) => out.push({ k: 'plan', i: p.id }));
  Object.keys(st.meta.weeks).forEach((w) => readRecord('week', w, st) && out.push({ k: 'week', i: w }));
  GOALS.forEach((q) => {
    const g = st.meta.goals[q];
    if (g && (g.text || g.done || g.items?.length)) out.push({ k: 'goal', i: q });
  });
  st.posts.forEach((p) => out.push({ k: 'post', i: p.id }));
  st.income.forEach((x) => out.push({ k: 'income', i: x.id }));
  Object.values(st.logs).forEach((days) =>
    Object.entries(days).forEach(([date, vals]) =>
      Object.entries(vals).forEach(([hid, v]) => {
        if (v > 0) out.push({ k: 'log', i: logId(date, hid) });
      }),
    ),
  );
  Object.values(st.journal).forEach((days) =>
    Object.entries(days).forEach(([date, j]) => {
      if (!journalEmpty(j)) out.push({ k: 'journal', i: date });
    }),
  );
  return out;
}
