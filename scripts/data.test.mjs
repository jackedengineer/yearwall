// Tests for the SQLite repo, store actions and habit logic.
// Run with: npm test   (compiles src/data + src/utils to .test-build first)
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const store = require('../.test-build/data/store.js');
const state = require('../.test-build/data/state.js');
const logic = require('../.test-build/utils/logic.js');
const repo = require('../.test-build/data/repo.js');

function adapter(file = ':memory:') {
  const d = new DatabaseSync(file);
  return {
    exec: (sql) => d.exec(sql),
    run: (sql, p = []) => d.prepare(sql).run(...p),
    all: (sql, p = []) => d.prepare(sql).all(...p),
    tx: (fn) => {
      d.exec('BEGIN');
      try {
        fn();
        d.exec('COMMIT');
      } catch (e) {
        d.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log('  ok', name);
};
const S = state.S;
const H = (id) => S.meta.habits.find((h) => h.id === id);

const db = adapter();
store.initStore(db);

test('first run seeds the Chapter 1 plan', () => {
  assert.equal(S.meta.chapters.length, 9);
  assert.equal(S.meta.habits.length, 4);
  assert.equal(S.posts.length, 22);
  assert.equal(S.meta.plans.length, 6);
  assert.equal(S.meta.weeks['1'].focus, 'Day Zero');
  assert.equal(S.meta.chapters[0].phases.length, 5);
  assert.equal(S.meta.chapters[0].tests.length, 5);
  assert.deepEqual(H('h_med').targets.map((t) => t.value), [30, 50, 80, 100, 120]);
  assert.equal(S.meta.settings.currency, '₹');
});

test('reloading from SQLite gives the same data', () => {
  const again = repo.loadAll();
  assert.deepEqual(JSON.parse(JSON.stringify(again.meta)), JSON.parse(JSON.stringify(S.meta)));
  assert.deepEqual(again.posts, S.posts);
});

test('migrate is safe to run twice', () => {
  repo.migrate();
  assert.equal(db.all('PRAGMA user_version')[0].user_version, 1);
});

test('ramping targets follow the date', () => {
  const m = H('h_med');
  assert.equal(logic.targetOn(m, '2026-11-17'), 30);
  assert.equal(logic.targetOn(m, '2026-11-23'), 50);
  assert.equal(logic.targetOn(m, '2026-12-15'), 120);
});

test('habits are inactive before Day 0 and during the retreat', () => {
  const y = H('h_yoga');
  assert.equal(logic.isActive(y, '2026-11-16'), false);
  assert.equal(logic.isActive(y, '2026-11-17'), true);
  assert.equal(logic.isActive(y, '2026-12-25'), false);
  assert.equal(logic.isActive(y, '2027-01-02'), true);
  assert.equal(logic.dayScore('2026-11-16'), null);
});

test('logging minutes, checks and the journal', () => {
  ['2026-11-17', '2026-11-18', '2026-11-19'].forEach((d) => {
    store.actions.setValue(H('h_med'), d, 30);
    store.actions.setValue(H('h_yoga'), d, 45);
    store.actions.setValue(H('h_read'), d, 1);
    store.actions.saveJournal(d, { text: 'Sat for a while.' });
  });
  assert.equal(logic.doneOn(H('h_log'), '2026-11-18'), true);
  assert.equal(logic.dayScore('2026-11-18'), 1);
  assert.equal(logic.streak(H('h_med'), '2026-11-19').n, 3);
  // today not done yet does not break the streak
  assert.equal(logic.streak(H('h_med'), '2026-11-20').n, 3);
  // a missed day does
  assert.equal(logic.streak(H('h_med'), '2026-11-21').n, 0);
  store.actions.setValue(H('h_med'), '2026-11-19', 0);
  assert.equal(logic.streak(H('h_med'), '2026-11-19').n, 2); // unfinished today keeps yesterday's streak
  assert.equal(logic.streak(H('h_med'), '2026-11-20').n, 0); // once the day passes, it breaks
  store.actions.setValue(H('h_med'), '2026-11-19', 30);
});

test('perfect week and year stats', () => {
  assert.equal(logic.isPerfect(1, '2026-11-19'), false); // week not finished
  ['2026-11-20', '2026-11-21', '2026-11-22'].forEach((d) => {
    store.actions.setValue(H('h_med'), d, 30);
    store.actions.setValue(H('h_yoga'), d, 45);
    store.actions.setValue(H('h_read'), d, 1);
    store.actions.saveJournal(d, { text: 'ok' });
  });
  assert.equal(logic.isPerfect(1, '2026-11-22'), true);
  const st = logic.yearStats('2026-11-22');
  assert.deepEqual(st, { active: 6, best: 6, perfect: 1 });
});

test('streak skips paused days', () => {
  const h = { ...H('h_read'), id: 'h_tmp', pauses: [{ from: '2026-11-20', to: '2026-11-21' }] };
  store.actions.saveHabit(h);
  ['2026-11-18', '2026-11-19', '2026-11-22'].forEach((d) => store.actions.setValue(h, d, 1));
  assert.equal(logic.streak(H('h_tmp'), '2026-11-22').n, 3);
  store.actions.deleteHabit('h_tmp');
  assert.equal(S.meta.habits.length, 4);
});

test('weekly-target habits count weeks', () => {
  const h = { id: 'h_w', name: 'Class', type: 'check', step: 1, daysPerWeek: 2, targets: [{ from: '2026-11-16', value: 1 }], activeFrom: '2026-11-16', activeTo: null, pauses: [] };
  store.actions.saveHabit(h);
  store.actions.setValue(h, '2026-11-17', 1);
  store.actions.setValue(h, '2026-11-19', 1);
  store.actions.setValue(h, '2026-11-24', 1);
  store.actions.setValue(h, '2026-11-26', 1);
  assert.deepEqual(logic.streak(H('h_w'), '2026-11-27'), { n: 2, unit: 'week' });
  store.actions.deleteHabit('h_w');
});

test('plans, posts, income, tests, weeks and goals save and reload', () => {
  store.actions.addPlan('Client call', '2026-11-27', '2026-11-25', 'work');
  const p = S.meta.plans.find((x) => x.title === 'Client call');
  assert.equal(p.start, '2026-11-25'); // swapped into order
  store.actions.savePost({ ...S.posts[0], status: 'Posted', link: 'https://example.com' });
  store.actions.saveIncome({ id: 'i1', date: '2026-11-21', source: 'freelance', amount: 25000, note: 'Landing page' });
  store.actions.saveTest('c1', { ...S.meta.chapters[0].tests[0], baseline: 12, latest: 20 });
  store.actions.saveWeek(3, { notes: 'Felt good' });
  store.actions.saveGoal(1, { text: 'Finish Vipassana', done: false });
  store.actions.saveSettings({ monthlyTarget: 60000 });
  const r = repo.loadAll();
  assert.ok(r.meta.plans.some((x) => x.title === 'Client call' && x.end === '2026-11-27'));
  assert.equal(r.posts[0].status, 'Posted');
  assert.equal(r.income[0].amount, 25000);
  assert.equal(r.meta.chapters[0].tests[0].latest, 20);
  assert.equal(r.meta.weeks['3'].focus, 'First Wins');
  assert.equal(r.meta.weeks['3'].notes, 'Felt good');
  assert.equal(r.meta.goals.q1.text, 'Finish Vipassana');
  assert.equal(r.meta.settings.monthlyTarget, 60000);
  assert.equal(r.logs['2026-11']['2026-11-18'].h_med, 30);
  assert.equal(r.journal['2026-11']['2026-11-18'].text, 'Sat for a while.');
  assert.equal(logic.testProgress(r.meta.chapters[0].tests[0]), 8 / 48);
});

test('export then import into a fresh database round-trips', () => {
  const json = store.actions.exportJson();
  const before = JSON.parse(json);
  const db2 = adapter();
  store.initStore(db2); // fresh template
  store.actions.importJson(json);
  const r = repo.loadAll();
  assert.equal(r.posts.length, before.posts.length);
  assert.equal(r.income.length, 1);
  assert.equal(r.meta.plans.length, before.meta.plans.length);
  assert.deepEqual(r.logs, before.logs);
  assert.deepEqual(r.journal['2026-11']['2026-11-18'], { text: 'Sat for a while.', feynman: '', energy: null });
  assert.throws(() => store.actions.importJson('{"hello":1}'));
});

test('imports a backup exported by the web version', () => {
  const web = {
    exportedAt: '2026-11-18T10:00:00Z',
    meta: { ...JSON.parse(store.actions.exportJson()).meta },
    posts: [],
    income: [],
    logs: { '2026-11': { '2026-11-17': { h_med: 30, h_read: 1 } } },
    journal: { '2026-11': { '2026-11-17': { text: 'from the web app', energy: 4 } } },
  };
  store.actions.importJson(JSON.stringify(web));
  assert.equal(logic.valueOn(H('h_med'), '2026-11-17'), 30);
  assert.equal(logic.journalOn('2026-11-17').energy, 4);
  assert.equal(S.posts.length, 0);
});

test('board helpers', () => {
  const months = logic.monthsOfYear();
  assert.equal(months.length, 13);
  assert.deepEqual(months[0].weeks, [1, 2]);
  assert.equal(months.reduce((a, m) => a + m.weeks.length, 0), 52);
  assert.equal(logic.moneyMonths()[0], '2026-11');
  assert.equal(logic.moneyMonths()[12], '2027-11');
  assert.equal(logic.chapterAt('2026-12-25').name, 'Stillness');
  assert.equal(logic.nextChapter('2027-01-02').name, 'The Pitch');
  assert.equal(logic.nextMilestone('2026-11-16').title, 'Vipassana');
});

console.log(`\n${passed} tests passed`);
