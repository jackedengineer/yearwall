/**
 * SQLite storage. All data lives in one local file (yearwall.db) on the phone.
 * The app keeps a full copy in memory (state.ts) and writes each change here
 * straight away, so nothing depends on a network.
 *
 * Db is a tiny adapter so the same code runs on expo-sqlite (app) and
 * node:sqlite (tests in scripts/).
 */
import type { Chapter, GoalItem, GoalKey, Habit, HabitColor, Income, JournalEntry, Meta, Plan, Post, Settings, State, WeekInfo } from './types';

export type Row = Record<string, any>;
export interface Db {
  exec(sql: string): void;
  run(sql: string, params?: any[]): void;
  all<T = Row>(sql: string, params?: any[]): T[];
  tx(fn: () => void): void;
}

let db: Db;
export const setDb = (d: Db) => {
  db = d;
};

// Transactions nest (replaceAll calls saveChapter), so only the outermost one opens a real transaction.
let depth = 0;
export const batch = (fn: () => void) => tx(fn);
function tx(fn: () => void) {
  if (depth > 0) return fn();
  depth++;
  try {
    db.tx(fn);
  } finally {
    depth--;
  }
}

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY NOT NULL, n INTEGER NOT NULL, name TEXT NOT NULL, skill TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL, end_date TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS phases (chapter_id TEXT NOT NULL, sort INTEGER NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', PRIMARY KEY (chapter_id, sort));
CREATE TABLE IF NOT EXISTS tests (id TEXT PRIMARY KEY NOT NULL, chapter_id TEXT NOT NULL, sort INTEGER NOT NULL, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT '', better TEXT NOT NULL DEFAULT 'higher', baseline REAL, target REAL, latest REAL);
CREATE TABLE IF NOT EXISTS habits (id TEXT PRIMARY KEY NOT NULL, sort INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, auto TEXT, step INTEGER NOT NULL DEFAULT 5, days_per_week INTEGER NOT NULL DEFAULT 7, active_from TEXT NOT NULL, active_to TEXT);
CREATE TABLE IF NOT EXISTS habit_targets (habit_id TEXT NOT NULL, from_date TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (habit_id, from_date));
CREATE TABLE IF NOT EXISTS habit_pauses (habit_id TEXT NOT NULL, sort INTEGER NOT NULL, from_date TEXT NOT NULL, to_date TEXT NOT NULL, PRIMARY KEY (habit_id, sort));
CREATE TABLE IF NOT EXISTS logs (date TEXT NOT NULL, habit_id TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (date, habit_id));
CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, cat TEXT NOT NULL, milestone INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS weeks (week INTEGER PRIMARY KEY NOT NULL, focus TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS goals (quarter INTEGER PRIMARY KEY NOT NULL, text TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, bucket TEXT NOT NULL, format TEXT NOT NULL, platform TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, status TEXT NOT NULL, link TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS journal (date TEXT PRIMARY KEY NOT NULL, text TEXT NOT NULL DEFAULT '', feynman TEXT NOT NULL DEFAULT '', energy INTEGER);
CREATE TABLE IF NOT EXISTS income (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, source TEXT NOT NULL, amount REAL NOT NULL, note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
`;

export function migrate() {
  const v = Number(db.all<{ user_version: number }>('PRAGMA user_version')[0]?.user_version ?? 0);
  if (v < 1) {
    db.tx(() => db.exec(SCHEMA_V1));
    db.exec('PRAGMA user_version = 1');
  }
  if (v < 2) {
    db.tx(() => db.exec(SCHEMA_V2));
    db.exec('PRAGMA user_version = 2');
  }
  if (v < 3) {
    db.tx(() => db.exec(SCHEMA_V3));
    db.exec('PRAGMA user_version = 3');
  }
  // Future schema changes: add `if (v < 4) { ... PRAGMA user_version = 4 }` here.
}

/** v2: sync bookkeeping. Which records changed when, which still need sending, and sync settings. */
const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS sync_records (kind TEXT NOT NULL, id TEXT NOT NULL, updated_at INTEGER NOT NULL, dirty INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kind, id));
CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`;

/** v3 (UX v2): each habit's colour, a plan's "did it happen" answer, and the quarter-goal checklist (JSON). */
const SCHEMA_V3 = `
ALTER TABLE habits ADD COLUMN color TEXT;
ALTER TABLE plans ADD COLUMN outcome TEXT;
ALTER TABLE goals ADD COLUMN items TEXT;
`;

const COLORS: HabitColor[] = ['green', 'violet', 'blue', 'amber', 'pink', 'teal'];
const parseItems = (json: string | null | undefined): GoalItem[] | undefined => {
  if (!json) return undefined;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === 'string' && typeof i.text === 'string').map((i) => ({ id: i.id, text: i.text, done: !!i.done })) : undefined;
  } catch {
    return undefined;
  }
};

/* ---------- sync bookkeeping (local only, never synced) ---------- */

export const syncLoad = () => db.all<{ kind: string; id: string; updated_at: number; dirty: number }>('SELECT kind, id, updated_at, dirty FROM sync_records');
export const syncMark = (kind: string, id: string, updatedAt: number, dirty: boolean) =>
  db.run('INSERT OR REPLACE INTO sync_records (kind, id, updated_at, dirty) VALUES (?, ?, ?, ?)', [kind, id, updatedAt, dirty ? 1 : 0]);
export const syncClean = (kind: string, id: string, updatedAt: number) =>
  db.run('UPDATE sync_records SET dirty = 0 WHERE kind = ? AND id = ? AND updated_at = ?', [kind, id, updatedAt]);
export const syncMetaGet = (key: string): string | null => db.all<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key])[0]?.value ?? null;
export const syncMetaSet = (key: string, value: string | null) =>
  value === null ? db.run('DELETE FROM sync_meta WHERE key = ?', [key]) : db.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [key, value]);
/** Switching to another server or key: pull everything again and re-send every record.
 *  Edit times are kept, so the later edit still wins on both sides and unsent edits aren't lost. */
export const syncReset = () => db.exec("UPDATE sync_records SET dirty = 1; DELETE FROM sync_meta WHERE key = 'cursor';");

/* ---------- load ---------- */

export function isEmpty() {
  return db.all('SELECT key FROM settings WHERE key = ?', ['settings']).length === 0;
}

export function loadAll(): State | null {
  if (isEmpty()) return null;
  const settings = JSON.parse(db.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['settings'])[0].value) as Settings;

  const phases = db.all('SELECT * FROM phases ORDER BY chapter_id, sort');
  const tests = db.all('SELECT * FROM tests ORDER BY chapter_id, sort');
  const chapters: Chapter[] = db.all('SELECT * FROM chapters ORDER BY start_date').map((c) => ({
    id: c.id,
    n: c.n,
    name: c.name,
    skill: c.skill,
    start: c.start_date,
    end: c.end_date,
    phases: phases.filter((p) => p.chapter_id === c.id).map((p) => ({ name: p.name, start: p.start_date, end: p.end_date, note: p.note })),
    tests: tests
      .filter((t) => t.chapter_id === c.id)
      .map((t) => ({ id: t.id, name: t.name, unit: t.unit, better: t.better, baseline: t.baseline, target: t.target, latest: t.latest })),
  }));

  const targets = db.all('SELECT * FROM habit_targets ORDER BY habit_id, from_date');
  const pauses = db.all('SELECT * FROM habit_pauses ORDER BY habit_id, sort');
  const habits: Habit[] = db.all('SELECT * FROM habits ORDER BY sort').map((h) => ({
    id: h.id,
    name: h.name,
    type: h.type,
    auto: h.auto ?? null,
    step: h.step,
    daysPerWeek: h.days_per_week,
    activeFrom: h.active_from,
    activeTo: h.active_to ?? null,
    targets: targets.filter((t) => t.habit_id === h.id).map((t) => ({ from: t.from_date, value: t.value })),
    pauses: pauses.filter((p) => p.habit_id === h.id).map((p) => ({ from: p.from_date, to: p.to_date })),
    ...(COLORS.includes(h.color) ? { color: h.color as HabitColor } : {}),
  }));

  const plans: Plan[] = db.all('SELECT * FROM plans ORDER BY start_date, rowid').map((p) => ({
    id: p.id,
    title: p.title,
    start: p.start_date,
    end: p.end_date,
    cat: p.cat,
    milestone: !!p.milestone,
    ...(p.outcome === 'done' || p.outcome === 'missed' ? { outcome: p.outcome as 'done' | 'missed' } : {}),
  }));

  const weeks: Meta['weeks'] = {};
  db.all('SELECT * FROM weeks').forEach((w) => {
    weeks[String(w.week)] = { focus: w.focus, notes: w.notes };
  });

  const goals: Meta['goals'] = {
    q1: { text: '', done: false },
    q2: { text: '', done: false },
    q3: { text: '', done: false },
    q4: { text: '', done: false },
  };
  db.all('SELECT * FROM goals').forEach((g) => {
    const items = parseItems(g.items);
    goals[`q${g.quarter}` as GoalKey] = { text: g.text, done: !!g.done, ...(items ? { items } : {}) };
  });

  const posts: Post[] = db.all('SELECT * FROM posts ORDER BY date, rowid').map((p) => ({
    id: p.id,
    title: p.title,
    bucket: p.bucket,
    format: p.format,
    platform: p.platform,
    date: p.date,
    status: p.status,
    link: p.link,
  }));
  const income: Income[] = db.all('SELECT * FROM income ORDER BY date, rowid').map((i) => ({
    id: i.id,
    date: i.date,
    source: i.source,
    amount: i.amount,
    note: i.note,
  }));

  const logs: State['logs'] = {};
  db.all('SELECT * FROM logs').forEach((l) => {
    const m = String(l.date).slice(0, 7);
    ((logs[m] ??= {})[l.date] ??= {})[l.habit_id] = l.value;
  });
  const journal: State['journal'] = {};
  db.all('SELECT * FROM journal').forEach((j) => {
    const m = String(j.date).slice(0, 7);
    (journal[m] ??= {})[j.date] = { text: j.text, feynman: j.feynman, energy: j.energy ?? null };
  });

  return { meta: { v: 1, settings, chapters, habits, plans, weeks, goals }, posts, income, logs, journal };
}

/* ---------- writes ---------- */

export const saveSettings = (s: Settings) =>
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['settings', JSON.stringify(s)]);

export function saveChapter(c: Chapter) {
  tx(() => {
    db.run('INSERT OR REPLACE INTO chapters (id, n, name, skill, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)', [c.id, c.n, c.name, c.skill || '', c.start, c.end]);
    db.run('DELETE FROM phases WHERE chapter_id = ?', [c.id]);
    (c.phases || []).forEach((p, i) =>
      db.run('INSERT INTO phases (chapter_id, sort, name, start_date, end_date, note) VALUES (?, ?, ?, ?, ?, ?)', [c.id, i, p.name, p.start, p.end, p.note || '']),
    );
    db.run('DELETE FROM tests WHERE chapter_id = ?', [c.id]);
    (c.tests || []).forEach((t, i) =>
      db.run('INSERT INTO tests (id, chapter_id, sort, name, unit, better, baseline, target, latest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        t.id,
        c.id,
        i,
        t.name,
        t.unit || '',
        t.better,
        t.baseline,
        t.target,
        t.latest,
      ]),
    );
  });
}

export function deleteChapter(id: string) {
  tx(() => {
    db.run('DELETE FROM chapters WHERE id = ?', [id]);
    db.run('DELETE FROM phases WHERE chapter_id = ?', [id]);
    db.run('DELETE FROM tests WHERE chapter_id = ?', [id]);
  });
}

export function saveHabit(h: Habit, sort: number) {
  tx(() => {
    db.run('INSERT OR REPLACE INTO habits (id, sort, name, type, auto, step, days_per_week, active_from, active_to, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      h.id,
      sort,
      h.name,
      h.type,
      h.auto ?? null,
      h.step || 1,
      h.daysPerWeek || 7,
      h.activeFrom,
      h.activeTo ?? null,
      h.color ?? null,
    ]);
    db.run('DELETE FROM habit_targets WHERE habit_id = ?', [h.id]);
    const seen = new Set<string>();
    (h.targets || []).forEach((t) => {
      if (seen.has(t.from)) return;
      seen.add(t.from);
      db.run('INSERT INTO habit_targets (habit_id, from_date, value) VALUES (?, ?, ?)', [h.id, t.from, Math.round(t.value)]);
    });
    db.run('DELETE FROM habit_pauses WHERE habit_id = ?', [h.id]);
    (h.pauses || []).forEach((p, i) => db.run('INSERT INTO habit_pauses (habit_id, sort, from_date, to_date) VALUES (?, ?, ?, ?)', [h.id, i, p.from, p.to]));
  });
}

/** Removes the habit. Its past log rows stay, so history is not lost. */
export function deleteHabit(id: string) {
  tx(() => {
    db.run('DELETE FROM habits WHERE id = ?', [id]);
    db.run('DELETE FROM habit_targets WHERE habit_id = ?', [id]);
    db.run('DELETE FROM habit_pauses WHERE habit_id = ?', [id]);
  });
}

export const savePlan = (p: Plan) =>
  db.run(
    `INSERT INTO plans (id, title, start_date, end_date, cat, milestone, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, start_date = excluded.start_date, end_date = excluded.end_date,
     cat = excluded.cat, milestone = excluded.milestone, outcome = excluded.outcome`,
    [p.id, p.title, p.start, p.end, p.cat, p.milestone ? 1 : 0, p.outcome ?? null],
  );
export const deletePlan = (id: string) => db.run('DELETE FROM plans WHERE id = ?', [id]);

export const saveWeek = (w: number, info: WeekInfo) =>
  db.run('INSERT OR REPLACE INTO weeks (week, focus, notes) VALUES (?, ?, ?)', [w, info.focus || '', info.notes || '']);

/** `items` is the checklist (schema v3); `text`/`done` mirror it for older clients. */
export const saveGoal = (q: number, text: string, done: boolean, items?: GoalItem[]) =>
  db.run('INSERT OR REPLACE INTO goals (quarter, text, done, items) VALUES (?, ?, ?, ?)', [q, text, done ? 1 : 0, items ? JSON.stringify(items) : null]);

// Upsert (not REPLACE) keeps the row's rowid, so posts keep their order within a day.
export const savePost = (p: Post) =>
  db.run(
    `INSERT INTO posts (id, title, bucket, format, platform, date, status, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, bucket = excluded.bucket, format = excluded.format,
     platform = excluded.platform, date = excluded.date, status = excluded.status, link = excluded.link`,
    [
    p.id,
    p.title,
    p.bucket,
    p.format,
    p.platform || '',
    p.date,
    p.status,
    p.link || '',
  ]);
export const deletePost = (id: string) => db.run('DELETE FROM posts WHERE id = ?', [id]);

export const saveIncome = (i: Income) =>
  db.run(
    `INSERT INTO income (id, date, source, amount, note) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET date = excluded.date, source = excluded.source, amount = excluded.amount, note = excluded.note`,
    [i.id, i.date, i.source, i.amount, i.note || ''],
  );
export const deleteIncome = (id: string) => db.run('DELETE FROM income WHERE id = ?', [id]);

export function setLog(date: string, habitId: string, value: number) {
  if (value > 0) db.run('INSERT OR REPLACE INTO logs (date, habit_id, value) VALUES (?, ?, ?)', [date, habitId, Math.round(value)]);
  else db.run('DELETE FROM logs WHERE date = ? AND habit_id = ?', [date, habitId]);
}

export function saveJournal(date: string, j: JournalEntry) {
  const empty = !(j.text || '').trim() && !(j.feynman || '').trim() && !j.energy;
  if (empty) db.run('DELETE FROM journal WHERE date = ?', [date]);
  else db.run('INSERT OR REPLACE INTO journal (date, text, feynman, energy) VALUES (?, ?, ?, ?)', [date, j.text || '', j.feynman || '', j.energy ?? null]);
}

/** Wipes the database and writes a whole state (first run, or importing a backup). */
export function replaceAll(s: State) {
  tx(() => {
    ['settings', 'chapters', 'phases', 'tests', 'habits', 'habit_targets', 'habit_pauses', 'logs', 'plans', 'weeks', 'goals', 'posts', 'journal', 'income'].forEach((t) =>
      db.exec(`DELETE FROM ${t}`),
    );
    saveSettings(s.meta.settings);
    s.meta.chapters.forEach(saveChapter);
    s.meta.habits.forEach((h, i) => saveHabit(h, i));
    s.meta.plans.forEach(savePlan);
    Object.entries(s.meta.weeks || {}).forEach(([w, info]) => saveWeek(Number(w), info));
    (['q1', 'q2', 'q3', 'q4'] as GoalKey[]).forEach((q, i) => {
      const g = s.meta.goals?.[q];
      if (g && (g.text || g.done || g.items?.length)) saveGoal(i + 1, g.text || '', !!g.done, g.items);
    });
    s.posts.forEach(savePost);
    s.income.forEach(saveIncome);
    Object.values(s.logs || {}).forEach((days) =>
      Object.entries(days).forEach(([date, vals]) => Object.entries(vals).forEach(([hid, v]) => setLog(date, hid, Number(v)))),
    );
    Object.values(s.journal || {}).forEach((days) => Object.entries(days).forEach(([date, j]) => saveJournal(date, j)));
  });
}
