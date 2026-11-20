// Tests for the SQLite repo, store actions, habit logic and sync.
// Run with: npm test   (compiles src/data + src/utils to .test-build first)
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const store = require('../.test-build/data/store.js');
const state = require('../.test-build/data/state.js');
const logic = require('../.test-build/utils/logic.js');
const prog = require('../.test-build/utils/progress.js');
const theme = require('../.test-build/theme.js');
const repo = require('../.test-build/data/repo.js');
const syncLib = require('../.test-build/data/sync.js');
const syncLocal = require('../.test-build/data/sync-local.js');
const records = require('../.test-build/data/records.js');
// The real server code from the Cloudflare Worker (Node runs the TypeScript directly).
const server = await import('../web/worker/sync-db.ts');

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
const plan = (id) => S.meta.plans.find((p) => p.id === id);

const db = adapter();
store.initStore(db);

/* ---------- template and SQLite ---------- */

test('first run seeds the First Principles plan', () => {
  assert.equal(S.meta.chapters.length, 9);
  const c1 = S.meta.chapters[0];
  assert.equal(c1.name, 'First Principles');
  assert.equal(c1.start, '2026-11-20');
  assert.equal(c1.end, '2026-12-31');
  assert.equal(c1.phases.length, 6);
  assert.equal(c1.tests.length, 6);
  assert.deepEqual(
    S.meta.habits.map((h) => h.id),
    ['h_deep', 'h_teach', 'h_books', 'h_yoga', 'h_med', 'h_log'],
  );
  assert.deepEqual(H('h_deep').pauses, [
    { from: '2026-11-27', to: '2026-12-03' },
    { from: '2026-12-06', to: '2026-12-08' },
  ]);
  assert.equal(H('h_deep').daysPerWeek, 6);
  assert.equal(logic.targetOn(H('h_deep'), '2026-11-20'), 240);
  assert.equal(H('h_teach').daysPerWeek, 5);
  assert.equal(H('h_log').auto, 'journal');
  assert.equal(S.posts.length, 24);
  assert.equal(S.meta.plans.length, 9);
  assert.equal(Object.keys(S.meta.weeks).length, 7);
  assert.equal(S.meta.weeks['1'].focus, 'Learn how to learn');
  assert.equal(S.meta.settings.day0, '2026-11-20');
  assert.equal(S.meta.settings.tourDone, false);
});

test('reloading from SQLite gives the same data', () => {
  const again = repo.loadAll();
  assert.deepEqual(JSON.parse(JSON.stringify(again.meta)), JSON.parse(JSON.stringify(S.meta)));
  assert.deepEqual(again.posts, S.posts);
});

test('migrate is safe to run twice', () => {
  repo.migrate();
  assert.equal(db.all('PRAGMA user_version')[0].user_version, 2);
});

/* ---------- habit logic ---------- */

test('habits follow Day 0 and their pauses', () => {
  const deep = H('h_deep');
  assert.equal(logic.isActive(deep, '2026-11-19'), false);
  assert.equal(logic.isActive(deep, '2026-11-20'), true);
  assert.equal(logic.isActive(deep, '2026-11-27'), false); // family trip
  assert.equal(logic.isActive(deep, '2026-12-03'), false);
  assert.equal(logic.isActive(deep, '2026-12-04'), true);
  assert.equal(logic.isActive(deep, '2026-12-07'), false); // birthday trip
  assert.equal(logic.isActive(deep, '2026-12-09'), true);
  assert.equal(logic.dayScore('2026-11-19'), null);
});

test('ramping targets follow the date', () => {
  const ramp = { id: 'h_ramp', name: 'Ramp', type: 'minutes', step: 10, daysPerWeek: 7, targets: [{ from: '2026-11-20', value: 30 }, { from: '2026-11-23', value: 50 }, { from: '2026-12-14', value: 120 }], activeFrom: '2026-11-20', activeTo: null, pauses: [] };
  assert.equal(logic.targetOn(ramp, '2026-11-20'), 30);
  assert.equal(logic.targetOn(ramp, '2026-11-23'), 50);
  assert.equal(logic.targetOn(ramp, '2026-12-15'), 120);
});

// Week 1 runs Mon Nov 16 to Sun Nov 22; Day 0 is Fri Nov 20.
const logDay = (d) => {
  store.actions.setValue(H('h_deep'), d, 240);
  store.actions.setValue(H('h_teach'), d, 1);
  store.actions.setValue(H('h_books'), d, 20);
  store.actions.setValue(H('h_yoga'), d, 15);
  store.actions.setValue(H('h_med'), d, 10);
  store.actions.saveJournal(d, { text: 'Learned how to learn.' });
};

test('logging minutes, checks and the journal', () => {
  ['2026-11-20', '2026-11-21', '2026-11-22'].forEach(logDay);
  assert.equal(logic.doneOn(H('h_log'), '2026-11-21'), true);
  assert.equal(logic.dayScore('2026-11-21'), 1);
  assert.equal(logic.streak(H('h_med'), '2026-11-22').n, 3);
  // today not done yet does not break the streak
  assert.equal(logic.streak(H('h_med'), '2026-11-23').n, 3);
  // a missed day does
  assert.equal(logic.streak(H('h_med'), '2026-11-24').n, 0);
  store.actions.setValue(H('h_med'), '2026-11-22', 0);
  assert.equal(logic.streak(H('h_med'), '2026-11-22').n, 2); // unfinished today keeps yesterday's streak
  assert.equal(logic.streak(H('h_med'), '2026-11-23').n, 0); // once the day passes, it breaks
  store.actions.setValue(H('h_med'), '2026-11-22', 10);
});

test('perfect week and year stats', () => {
  assert.equal(logic.isPerfect(1, '2026-11-21'), false); // 2 of the 3 scheduled days so far
  assert.equal(logic.isPerfect(1, '2026-11-22'), true);
  assert.deepEqual(logic.yearStats('2026-11-22'), { active: 3, best: 3, perfect: 1 });
});

test('streak skips paused days', () => {
  const h = { ...H('h_books'), id: 'h_tmp', pauses: [{ from: '2026-11-24', to: '2026-11-25' }] };
  store.actions.saveHabit(h);
  ['2026-11-22', '2026-11-23', '2026-11-26'].forEach((d) => store.actions.setValue(h, d, 20));
  assert.equal(logic.streak(H('h_tmp'), '2026-11-26').n, 3);
  store.actions.deleteHabit('h_tmp');
  assert.equal(S.meta.habits.length, 6);
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

/* ---------- progress: cards, strip, colours, toasts ---------- */

test('weekly progress', () => {
  const deep = H('h_deep');
  // Week 1: active Fri to Sun only, so 6 days a week becomes 3.
  assert.deepEqual(prog.weekProgress(deep, '2026-11-22'), { done: 3, target: 3, left: 0, met: true, scheduled: 3 });
  assert.equal(prog.weekProgress(deep, '2026-11-22').met, logic.weekHit(deep, 1, '2026-11-22'));
  // Week 2 (Nov 23 to 29): the family trip pauses Deep work from Fri, so the target drops to 4.
  store.actions.setValue(deep, '2026-11-23', 240);
  store.actions.setValue(deep, '2026-11-24', 120); // part of a day doesn't count
  assert.deepEqual(prog.weekProgress(deep, '2026-11-25'), { done: 1, target: 4, left: 3, met: false, scheduled: 4 });
  assert.deepEqual(prog.weekProgress(H('h_teach'), '2026-11-25'), { done: 0, target: 5, left: 5, met: false, scheduled: 7 });
  // Week 3: only Dec 4 and 5 are free of trips.
  assert.deepEqual(prog.weekProgress(deep, '2026-11-30'), { done: 0, target: 2, left: 2, met: false, scheduled: 2 });
});

test('week-strip states', () => {
  const med = H('h_med'); // every day, 10 min, done Nov 20 to 22
  store.actions.setValue(med, '2026-11-23', 10);
  store.actions.setValue(med, '2026-11-24', 5);
  const strip = prog.weekStrip(med, '2026-11-26'); // Thursday
  assert.deepEqual(
    strip.map((d) => d.state),
    ['done', 'partial', 'missed', 'empty', 'future', 'future', 'future'],
  );
  assert.deepEqual(
    strip.map((d) => d.today),
    [false, false, false, true, false, false, false],
  );
  assert.deepEqual(
    strip.map((d) => d.value),
    [10, 5, 0, 0, 0, 0, 0],
  );
  // Before Day 0 the days are off.
  assert.deepEqual(
    prog.weekStrip(med, '2026-11-22').map((d) => d.state),
    ['off', 'off', 'off', 'off', 'done', 'done', 'done'],
  );
  // Deep work runs 6 days a week: an empty past day is a free day, not a miss. Paused days are off.
  assert.deepEqual(
    prog.weekStrip(H('h_deep'), '2026-11-26').map((d) => d.state),
    ['done', 'partial', 'empty', 'empty', 'off', 'off', 'off'],
  );
  assert.equal(prog.progressLine(H('h_teach'), '2026-11-26'), '0 of 5 this week');
  assert.equal(prog.progressLine(med, '2026-11-24'), '5 of 10 min Nov 24');
});

test('default habit colours', () => {
  assert.deepEqual(
    S.meta.habits.map((h) => prog.habitColorId(h)),
    ['green', 'violet', 'blue', 'amber', 'pink', 'teal'],
  );
  const seventh = { ...H('h_books'), id: 'h_7' };
  assert.equal(prog.habitColorId(seventh, [...S.meta.habits, seventh]), 'green'); // wraps after 6
  assert.equal(prog.habitColorId({ ...H('h_books'), color: 'pink' }), 'pink'); // its own colour wins
  assert.equal(prog.habitColorId({ ...H('h_books'), color: 'plaid' }), 'blue'); // unknown colour: default
  assert.equal(prog.habitColor(H('h_deep')).fill, theme.HABIT_COLORS.green.fill);
  // A new habit gets the first colour nobody uses.
  store.actions.saveHabit({ ...H('h_teach'), color: 'green' });
  assert.equal(prog.nextHabitColor(), 'violet');
  assert.equal(records.readRecord('habit', 'h_teach').color, 'green'); // the colour syncs
  const { color, ...plain } = H('h_teach');
  store.actions.saveHabit(plain);
  assert.equal(prog.habitColorId(H('h_teach')), 'violet');
});

test('one tap logs a habit, and the toast says what happened', () => {
  const d = '2026-11-25';
  const teach = H('h_teach');
  assert.deepEqual(store.actions.tick(teach, d), { before: 0, after: 1 });
  assert.equal(prog.logMessage(teach, d, 0, 1, d), 'Teach one thing in public logged. 1 of 5 this week, 4 to go.');
  assert.deepEqual(store.actions.tick(teach, d), { before: 1, after: 0 });
  assert.equal(prog.logMessage(teach, d, 1, 0, d), 'Teach one thing in public unlogged.');
  // A minutes habit adds one step (30 min) per tap.
  const deep = H('h_deep');
  assert.deepEqual(store.actions.tick(deep, d), { before: 0, after: 30 });
  assert.equal(prog.logMessage(deep, d, 0, 30, d), 'Deep work: 30 of 240 min today.');
  store.actions.setValue(deep, d, 210);
  assert.deepEqual(store.actions.tick(deep, d), { before: 210, after: 240 });
  assert.equal(prog.logMessage(deep, d, 210, 240, d), 'Deep work logged. 2 of 4 this week, 2 to go.');
  assert.equal(prog.logMessage(deep, d, 240, 270, d), 'Deep work: 270 min today.');
  // Undo puts the old value back.
  store.actions.setValue(deep, d, 210);
  assert.equal(logic.valueOn(deep, d), 210);
  // Past days say which day.
  store.actions.tick(teach, '2026-11-23');
  assert.equal(prog.logMessage(teach, '2026-11-23', 0, 1, d), 'Teach one thing in public logged for Mon, Nov 23. 1 of 5 this week, 4 to go.');
  ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'].forEach((x) => store.actions.tick(teach, x));
  assert.equal(prog.logMessage(teach, '2026-11-27', 0, 1, '2026-11-27'), 'Teach one thing in public logged. 5 of 5 this week. Week done.');
  // The nightly log ticks itself from the journal.
  assert.equal(store.actions.tick(H('h_log'), d), null);
  // A day in an earlier week says "that week".
  assert.equal(prog.logMessage(teach, '2026-11-21', 0, 1, d), 'Teach one thing in public logged for Sat, Nov 21. 3 of 3 that week. Week done.');
});

/* ---------- plans, goals, year ---------- */

test('plan outcomes', () => {
  const ref = '2026-11-25';
  assert.equal(prog.needsOutcome(plan('pl1'), ref), true); // Day 0 has passed
  assert.equal(prog.needsOutcome(plan('pl7'), ref), false); // the trip hasn't ended
  store.actions.setPlanOutcome('pl1', 'done');
  assert.equal(plan('pl1').outcome, 'done');
  assert.equal(prog.needsOutcome(plan('pl1'), ref), false);
  assert.equal(records.readRecord('plan', 'pl1').outcome, 'done'); // it syncs
  store.actions.setPlanOutcome('pl1', null); // Undo writes null, so the server clears it
  assert.equal(plan('pl1').outcome, null);
  assert.equal(records.readRecord('plan', 'pl1').outcome, null);
  assert.equal(prog.needsOutcome(plan('pl1'), ref), true);
  store.actions.setPlanOutcome('pl1', 'missed');
  assert.equal(plan('pl1').outcome, 'missed');
  // Removing a plan hands it back, so Undo can restore it.
  const gone = store.actions.deletePlan('pl11');
  assert.equal(gone.title, 'Talk to 10 potential users');
  assert.equal(plan('pl11'), undefined);
  store.actions.savePlan(gone);
  assert.equal(plan('pl11').title, 'Talk to 10 potential users');
  // Plans in a week, and quick-add dates from weekday chips.
  assert.deepEqual(
    prog.plansInWeek(2).map((p) => p.id),
    ['pl7'],
  );
  assert.deepEqual(prog.rangeFromDays(4, [4, 0, 2]), { start: '2026-12-07', end: '2026-12-11' });
  assert.equal(prog.rangeFromDays(4, []), null);
  assert.equal(prog.whenLabel('2026-12-07', '2026-12-11'), 'Dec 7–11');
  assert.equal(prog.whenLabel('2026-12-30', '2027-01-02'), 'Dec 30 – Jan 2');
  assert.equal(prog.whenLabel('2026-12-07', '2026-12-07'), 'Dec 7');
});

test('goal items and the migration from text', () => {
  // A goal saved before checklists becomes the first item.
  assert.deepEqual(prog.goalItems({ text: 'Launch the tracker', done: false }, 'q1'), [{ id: 'q1-1', text: 'Launch the tracker', done: false }]);
  assert.deepEqual(prog.goalItems({ text: '  ', done: false }, 'q1'), []);
  assert.deepEqual(prog.goalItems(undefined, 'q1'), []);
  // Saving a checklist mirrors it into text and done for older clients.
  store.actions.saveGoalItems(1, [
    { id: 'g1', text: 'Launch the tracker', done: true },
    { id: 'g2', text: ' Ship the gateway ', done: false },
  ]);
  const g = S.meta.goals.q1;
  assert.deepEqual(g, {
    text: 'Launch the tracker\nShip the gateway',
    done: false,
    items: [
      { id: 'g1', text: 'Launch the tracker', done: true },
      { id: 'g2', text: 'Ship the gateway', done: false },
    ],
  });
  assert.deepEqual(prog.goalItems(g, 'q1'), g.items);
  assert.deepEqual(records.readRecord('goal', 'q1'), g); // it syncs
  // An older client edited the text: the checklist follows it and keeps ticks on unchanged lines.
  const edited = { ...g, text: 'Launch the tracker\nShip the gateway\nWrite the recap' };
  assert.deepEqual(prog.goalItems(edited, 'q1'), [g.items[0], g.items[1], { id: 'q1-1', text: 'Write the recap', done: false }]);
  // At most 5: extra lines stay together in the fifth, so nothing is lost.
  assert.deepEqual(
    prog.goalItems({ text: 'a\nb\nc\nd\ne\nf', done: false }, 'q2').map((i) => i.text),
    ['a', 'b', 'c', 'd', 'e\nf'],
  );
  store.actions.saveGoalItems(2, ['1', '2', '3', '4', '5', '6'].map((t) => ({ id: 'x' + t, text: t, done: false })));
  assert.equal(S.meta.goals.q2.items.length, 5);
  // "Mark done" from an older client (done flips, text unchanged) applies to every goal.
  assert.deepEqual(
    prog.goalItems({ ...g, done: true }, 'q1').map((i) => i.done),
    [true, true],
  );
  assert.deepEqual(
    prog.goalItems({ ...g, items: g.items.map((i) => ({ ...i, done: true })), done: false }, 'q1').map((i) => i.done),
    [false, false],
  );
  // Rebuilt goals never reuse an id, and identical lines stay separate goals.
  const ids = prog.goalItems({ text: 'a\nb\na', done: false, items: [{ id: 'q1-2', text: 'a', done: true }] }, 'q1');
  assert.deepEqual(
    ids.map((i) => i.text),
    ['a', 'b', 'a'],
  );
  assert.equal(new Set(ids.map((i) => i.id)).size, 3);
  assert.deepEqual(
    ids.map((i) => i.done),
    [true, false, false],
  );
  // Every item done marks the quarter done for older clients.
  store.actions.saveGoalItems(1, g.items.map((i) => ({ ...i, done: true })));
  assert.equal(S.meta.goals.q1.done, true);
  // The phone (schema v2) keeps the text, so its goals still show.
  assert.equal(repo.loadAll().meta.goals.q1.text, 'Launch the tracker\nShip the gateway');
});

test('archiving keeps history and never moves an earlier end date', () => {
  const t = new Date();
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const ended = { ...H('h_books'), id: 'h_ended', activeFrom: '2026-11-16', activeTo: '2026-11-17' };
  store.actions.saveHabit(ended);
  store.actions.archiveHabit('h_ended');
  assert.equal(H('h_ended').activeTo, '2026-11-17'); // already ended: unchanged
  store.actions.saveHabit({ ...ended, activeTo: null });
  store.actions.archiveHabit('h_ended');
  assert.ok(H('h_ended').activeTo < today); // ends yesterday
  assert.equal(prog.isRunning(H('h_ended'), today), false);
  store.actions.deleteHabit('h_ended');
});

test('year progress, perfect-week runs and quarters', () => {
  assert.deepEqual(prog.yearProgress('2026-11-20'), { week: 1, weeks: 52, daysLeft: 359, pct: 1, started: true, ended: false });
  assert.equal(prog.yearProgress('2026-11-15').week, 0);
  assert.equal(prog.yearProgress('2027-11-14').daysLeft, 0);
  // Week 1 was perfect. Week 2 is still running, so it doesn't break the run yet...
  assert.deepEqual(prog.perfectWeeks('2026-11-25'), { count: 1, bestRun: 1, currentRun: 1 });
  // ...once it ends short, the run is over.
  assert.deepEqual(prog.perfectWeeks('2026-11-30'), { count: 1, bestRun: 1, currentRun: 0 });
  assert.equal(prog.quarterOf('2026-11-20'), 1);
  assert.equal(prog.quarterOf('2027-02-15'), 2);
  assert.deepEqual(prog.quarterRange(1), { start: '2026-11-16', end: '2027-02-14' });
});

test('plans, posts, income, tests, weeks and goals save and reload', () => {
  store.actions.addPlan('Client call', '2026-11-27', '2026-11-25', 'work');
  const p = S.meta.plans.find((x) => x.title === 'Client call');
  assert.equal(p.start, '2026-11-25'); // swapped into order
  store.actions.savePost({ ...S.posts[0], status: 'Posted', link: 'https://example.com' });
  store.actions.saveIncome({ id: 'i1', date: '2026-11-21', source: 'freelance', amount: 25000, note: 'Landing page' });
  store.actions.saveTest('c1', { ...S.meta.chapters[0].tests[0], baseline: 2, latest: 4 });
  store.actions.saveWeek(3, { notes: 'Felt good' });
  store.actions.saveSettings({ monthlyTarget: 60000 });
  const r = repo.loadAll();
  assert.ok(r.meta.plans.some((x) => x.title === 'Client call' && x.end === '2026-11-27'));
  assert.equal(r.posts[0].status, 'Posted');
  assert.equal(r.income[0].amount, 25000);
  assert.equal(r.meta.chapters[0].tests[0].latest, 4);
  assert.equal(r.meta.weeks['3'].focus, 'On the road: read and reflect');
  assert.equal(r.meta.weeks['3'].notes, 'Felt good');
  assert.equal(r.meta.settings.monthlyTarget, 60000);
  assert.equal(r.logs['2026-11']['2026-11-21'].h_med, 10);
  assert.equal(r.journal['2026-11']['2026-11-21'].text, 'Learned how to learn.');
  assert.equal(logic.testProgress(r.meta.chapters[0].tests[0]), 1 / 3);
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
  assert.deepEqual(r.journal['2026-11']['2026-11-21'], { text: 'Learned how to learn.', feynman: '', energy: null });
  // Backups carry the new fields. (The phone's SQLite stores them from schema v3, step 10.)
  assert.equal(before.meta.plans.find((x) => x.id === 'pl1').outcome, 'missed');
  assert.equal(before.meta.goals.q1.items.length, 2);
  assert.throws(() => store.actions.importJson('{"hello":1}'));
});

test('imports a backup exported by the web version', () => {
  const web = {
    exportedAt: '2026-11-18T10:00:00Z',
    meta: { ...JSON.parse(store.actions.exportJson()).meta },
    posts: [],
    income: [],
    logs: { '2026-11': { '2026-11-21': { h_med: 10, h_teach: 1 } } },
    journal: { '2026-11': { '2026-11-21': { text: 'from the web app', energy: 4 } } },
  };
  store.actions.importJson(JSON.stringify(web));
  assert.equal(logic.valueOn(H('h_med'), '2026-11-21'), 10);
  assert.equal(logic.journalOn('2026-11-21').energy, 4);
  assert.equal(S.posts.length, 0);
});

test('board helpers', () => {
  const months = logic.monthsOfYear();
  assert.equal(months.length, 13);
  assert.deepEqual(months[0].weeks, [1, 2]);
  assert.equal(months.reduce((a, m) => a + m.weeks.length, 0), 52);
  assert.equal(logic.moneyMonths()[0], '2026-11');
  assert.equal(logic.moneyMonths()[12], '2027-11');
  assert.equal(logic.chapterAt('2026-12-25').name, 'First Principles');
  assert.equal(logic.nextChapter('2027-01-02').name, 'The Pitch');
  assert.equal(logic.nextMilestone('2026-11-16').title, 'Launch the AI visibility tracker');
});

test('old-shape records still load', () => {
  // Records written before this version: no colour, outcome, checklist, auto, pauses or sort.
  store.applyRemote([
    { k: 'habit', i: 'h_old', u: 1, d: { id: 'h_old', name: 'Old habit', type: 'check', step: 1, daysPerWeek: 7, targets: [{ from: '2026-11-20', value: 1 }], activeFrom: '2026-11-20', activeTo: null } },
    { k: 'plan', i: 'pl_old', u: 1, d: { id: 'pl_old', title: 'Old plan', start: '2026-11-21', end: '2026-11-21', cat: 'work' } },
    { k: 'goal', i: 'q3', u: 1, d: { text: 'Old goal', done: true } },
    { k: 'log', i: '2026-11-21|h_old', u: 1, d: { v: 1 } },
  ]);
  const old = H('h_old');
  assert.equal(S.meta.habits.at(-1).id, 'h_old');
  assert.equal(prog.habitColorId(old), 'green'); // 7th habit wraps to the first colour
  assert.deepEqual(
    prog.weekStrip(old, '2026-11-22').map((d) => d.state),
    ['off', 'off', 'off', 'off', 'missed', 'done', 'empty'],
  );
  assert.equal(logic.streak(old, '2026-11-21').n, 1);
  assert.equal(prog.needsOutcome(plan('pl_old'), '2026-11-25'), true);
  assert.deepEqual(prog.goalItems(S.meta.goals.q3, 'q3'), [{ id: 'q3-1', text: 'Old goal', done: true }]);
  const r = repo.loadAll();
  assert.ok(r.meta.habits.some((h) => h.id === 'h_old'));
  assert.equal(r.meta.goals.q3.text, 'Old goal');
});

/* ---------- sync (phone engine against the real server code on node:sqlite) ---------- */

const atest = async (name, fn) => {
  await fn();
  passed++;
  console.log('  ok', name);
};

// The server's database: same SQL as D1, on node:sqlite.
const serverDb = new DatabaseSync(':memory:');
const sqlServer = {
  async batch(stmts) {
    serverDb.exec('BEGIN');
    try {
      const out = stmts.map((s) => {
        const st = serverDb.prepare(s.sql);
        return /^\s*SELECT/i.test(s.sql) ? st.all(...s.params) : (st.run(...s.params), []);
      });
      serverDb.exec('COMMIT');
      return out;
    } catch (e) {
      serverDb.exec('ROLLBACK');
      throw e;
    }
  },
};
await sqlServer.batch(server.SCHEMA.map((sql) => ({ sql, params: [] })));
const KEY = 'test-key';
// Stands in for fetch(): runs the Worker's sync logic directly.
const fakeFetch = async (_url, init) => {
  if (init.headers.authorization !== `Bearer ${KEY}`) return { ok: false, status: 401, json: async () => ({}) };
  const { since, push } = server.parseBody(JSON.parse(init.body));
  const body = await server.sync(sqlServer, since, push);
  return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
};
const serverRecs = async () => (await server.sync(sqlServer, 0, [])).pull;
const serverRec = async (k, i) => (await serverRecs()).find((r) => r.k === k && r.i === i);
// Another device editing: push records straight to the server.
const otherDevice = (recs) => server.sync(sqlServer, 0, recs);

// Sync wired up like the phone app does it, on the phone's current SQLite database.
function wire(pdb, key = KEY) {
  const local = syncLocal.sqliteSyncStore();
  const engine = syncLib.createSync({ store: local, endpoint: () => ({ url: 'https://example.test', key }), fetchFn: fakeFetch, debounceMs: 0 });
  store.setTouchHandler(engine.touch);
  return { pdb, local, engine };
}
// A phone: fresh SQLite with the template.
function phone(key = KEY) {
  const pdb = adapter();
  store.initStore(pdb);
  return wire(pdb, key);
}

let A = phone();

await atest('first sync sends everything the phone already has', async () => {
  await A.engine.syncNow();
  assert.equal(A.engine.status().state, 'ok');
  assert.equal(A.local.dirty().length, 0);
  assert.equal((await serverRecs()).length, records.allKeys().length);
  assert.equal((await serverRec('plan', 'pl10')).d.title, 'Chapter 1 finale');
  assert.ok(A.local.cursor() >= 1);
});

await atest('an edit on the phone reaches the server', async () => {
  store.actions.savePlan({ ...plan('pl11'), title: 'Talk to 12 potential users' });
  store.actions.setValue(H('h_med'), '2026-11-21', 10);
  assert.equal(A.local.dirty().length, 2);
  await A.engine.syncNow();
  assert.equal((await serverRec('plan', 'pl11')).d.title, 'Talk to 12 potential users');
  assert.deepEqual((await serverRec('log', '2026-11-21|h_med')).d, { v: 10 });
  assert.equal(A.local.dirty().length, 0);
});

await atest('edits and deletes from another device arrive on the phone and in SQLite', async () => {
  const later = Date.now() + 5000;
  await otherDevice([
    { k: 'plan', i: 'pl99', u: later, d: { id: 'pl99', title: 'Made on the web', start: '2027-02-01', end: '2027-02-03', cat: 'work' } },
    { k: 'post', i: 'p101', u: later, d: null },
    { k: 'log', i: '2026-11-21|h_med', u: later, d: null },
  ]);
  await A.engine.syncNow();
  assert.equal(plan('pl99').title, 'Made on the web');
  assert.equal(S.posts.some((p) => p.id === 'p101'), false);
  assert.equal(logic.valueOn(H('h_med'), '2026-11-21'), 0);
  const saved = repo.loadAll();
  assert.ok(saved.meta.plans.some((p) => p.id === 'pl99'));
  assert.equal(saved.posts.some((p) => p.id === 'p101'), false);
});

await atest('the later edit wins a conflict', async () => {
  store.actions.saveWeek(5, { focus: 'phone focus' });
  // An older edit from another device must not overwrite it.
  await otherDevice([{ k: 'week', i: '5', u: 1, d: { focus: 'stale web focus' } }]);
  await A.engine.syncNow();
  assert.equal(S.meta.weeks['5'].focus, 'phone focus');
  assert.equal((await serverRec('week', '5')).d.focus, 'phone focus');
  // A newer one does.
  await otherDevice([{ k: 'week', i: '5', u: Date.now() + 10000, d: { focus: 'newer web focus' } }]);
  await A.engine.syncNow();
  assert.equal(S.meta.weeks['5'].focus, 'newer web focus');
});

await atest('habit order follows the other device', async () => {
  await otherDevice([{ k: 'habit', i: 'h_med', u: Date.now() + 20000, d: { ...H('h_med'), sort: 1 } }]);
  await A.engine.syncNow();
  const order = ['h_deep', 'h_med', 'h_teach', 'h_books', 'h_yoga', 'h_log'];
  assert.deepEqual(
    S.meta.habits.map((h) => h.id),
    order,
  );
  assert.deepEqual(
    repo.loadAll().meta.habits.map((h) => h.id),
    order,
  );
});

await atest('a new phone takes the server data instead of its own template', async () => {
  const B = phone();
  assert.ok(S.posts.some((p) => p.id === 'p101')); // fresh template
  await B.engine.syncNow();
  assert.equal(S.posts.some((p) => p.id === 'p101'), false);
  assert.equal(plan('pl11').title, 'Talk to 12 potential users');
  assert.equal(S.meta.weeks['5'].focus, 'newer web focus');
  assert.equal(B.local.dirty().length, 0);
  A = B;
});

await atest('importing a backup syncs removed records as deletions', async () => {
  const backup = JSON.parse(store.actions.exportJson());
  backup.meta.plans = backup.meta.plans.filter((p) => p.id !== 'pl99');
  store.actions.importJson(JSON.stringify(backup));
  await A.engine.syncNow();
  assert.equal((await serverRec('plan', 'pl99')).d, null);
  assert.ok((await serverRec('plan', 'pl1')).d);
});

await atest('an old phone and the new web app editing the same habit, plan and goals', async () => {
  // The new web app gives Teach a colour, answers "Did it happen?" and ticks a goal.
  const later = Date.now() + 30000;
  await otherDevice([
    { k: 'habit', i: 'h_teach', u: later, d: { ...H('h_teach'), sort: 2, color: 'pink' } },
    { k: 'plan', i: 'pl1', u: later, d: { ...plan('pl1'), outcome: 'done' } },
    {
      k: 'goal',
      i: 'q1',
      u: later,
      d: { text: 'Launch the tracker\nShip the gateway', done: false, items: [{ id: 'g1', text: 'Launch the tracker', done: true }, { id: 'g2', text: 'Ship the gateway', done: false }] },
    },
  ]);
  await A.engine.syncNow();
  // While the old phone stays open it keeps everything in memory, and shows the goals as text.
  assert.equal(H('h_teach').color, 'pink');
  assert.equal(plan('pl1').outcome, 'done');
  assert.equal(repo.loadAll().meta.goals.q1.text, 'Launch the tracker\nShip the gateway');
  // The old phone restarts. Its SQLite (schema v2) has no colour, outcome or checklist columns.
  store.initStore(A.pdb);
  A = wire(A.pdb);
  assert.equal(H('h_teach').color, undefined);
  assert.equal(plan('pl1').outcome, undefined);
  // Records it doesn't touch keep everything on the server.
  await A.engine.syncNow();
  assert.equal((await serverRec('habit', 'h_teach')).d.color, 'pink');
  assert.equal((await serverRec('plan', 'pl1')).d.outcome, 'done');
  // When it edits the habit and the plan, it sends them without the new fields. The server merges
  // fields, so the colour and the answer survive, and the edit itself goes through.
  store.actions.saveHabit({ ...H('h_teach'), name: 'Teach one thing' });
  store.actions.savePlan({ ...plan('pl1'), title: 'Day 0: explain a design on camera' });
  await A.engine.syncNow();
  const teach = (await serverRec('habit', 'h_teach')).d;
  assert.equal(teach.name, 'Teach one thing');
  assert.equal(teach.color, 'pink');
  const p1 = (await serverRec('plan', 'pl1')).d;
  assert.equal(p1.title, 'Day 0: explain a design on camera');
  assert.equal(p1.outcome, 'done');
  // Deleting a habit re-saves (and re-sends) every other habit on the old phone; their colours survive too.
  await otherDevice([{ k: 'habit', i: 'h_books', u: Date.now() + 40000, d: { ...H('h_books'), sort: 3, color: 'amber' } }]);
  await A.engine.syncNow();
  store.initStore(A.pdb); // another restart: the colour isn't in its SQLite
  A = wire(A.pdb);
  store.actions.deleteHabit('h_yoga');
  await A.engine.syncNow();
  assert.equal((await serverRec('habit', 'h_books')).d.color, 'amber');
  assert.equal((await serverRec('habit', 'h_teach')).d.color, 'pink');
  // Tapping in and out of the goal box re-sends the same text: the ticks survive.
  store.actions.saveGoal(1, { text: 'Launch the tracker\nShip the gateway' }, true);
  await A.engine.syncNow();
  assert.deepEqual(
    prog.goalItems((await serverRec('goal', 'q1')).d, 'q1').map((i) => [i.text, i.done]),
    [
      ['Launch the tracker', true],
      ['Ship the gateway', false],
    ],
  );
  // Adding a line on the old phone keeps the ticks on the lines that didn't change.
  store.actions.saveGoal(1, { text: 'Launch the tracker\nShip the gateway\nWrite the recap' });
  await A.engine.syncNow();
  assert.deepEqual(
    prog.goalItems((await serverRec('goal', 'q1')).d, 'q1').map((i) => [i.text, i.done]),
    [
      ['Launch the tracker', true],
      ['Ship the gateway', false],
      ['Write the recap', false],
    ],
  );
  // "Mark done" on the old phone ticks every goal.
  store.actions.saveGoal(1, { done: true });
  await A.engine.syncNow();
  assert.ok(prog.goalItems((await serverRec('goal', 'q1')).d, 'q1').every((i) => i.done));
});

await atest('a wrong sync key is reported, and nothing is lost', async () => {
  const before = (await serverRecs()).length;
  const bad = syncLib.createSync({ store: A.local, endpoint: () => ({ url: 'https://example.test', key: 'nope' }), fetchFn: fakeFetch });
  store.actions.addPlan('Offline idea', '2027-03-01', '2027-03-01', 'personal');
  await bad.syncNow();
  assert.equal(bad.status().state, 'error');
  assert.equal(A.local.dirty().length, 1);
  assert.equal((await serverRecs()).length, before);
  await A.engine.syncNow();
  assert.equal(A.local.dirty().length, 0);
});

await atest('the web app sends nothing on its first sync, so its defaults never overwrite real data', async () => {
  const before = await serverRec('settings', 'settings');
  const web = syncLib.createSync({
    store: (() => {
      const m = new Map();
      let c = -1;
      return {
        cursor: () => c,
        setCursor: (r) => {
          c = r;
        },
        clock: (k, i) => m.get(k + i)?.u,
        mark: (k, i, u, d) => m.set(k + i, { k, i, u, d }),
        dirty: () => [...m.values()].filter((x) => x.d).map(({ k, i, u }) => ({ k, i, u })),
        clean: (k, i, u) => {
          const x = m.get(k + i);
          if (x && x.u === u) x.d = false;
        },
        batch: (fn) => fn(),
      };
    })(),
    endpoint: () => ({ url: 'https://example.test', key: KEY }),
    fetchFn: fakeFetch,
    adoptLocal: false,
  });
  await web.syncNow();
  assert.equal(web.status().state, 'ok');
  assert.deepEqual(await serverRec('settings', 'settings'), before);
});

await atest('changing the server address keeps unsent edits and re-sends everything', async () => {
  store.setTouchHandler(A.engine.touch);
  store.actions.saveWeek(9, { focus: 'edited just before switching' });
  repo.syncReset();
  const fresh = syncLocal.sqliteSyncStore();
  assert.equal(fresh.cursor(), -1);
  // Every record goes again, including deletions (which keep their edit time).
  assert.ok(fresh.dirty().length >= records.allKeys().length);
  const again = syncLib.createSync({ store: fresh, endpoint: () => ({ url: 'https://example.test', key: KEY }), fetchFn: fakeFetch });
  store.setTouchHandler(again.touch);
  await again.syncNow();
  assert.equal(fresh.dirty().length, 0);
  assert.equal((await serverRec('week', '9')).d.focus, 'edited just before switching');
  assert.equal(S.meta.weeks['9'].focus, 'edited just before switching');
});

await atest('the server merges fields: left out keeps, null clears, deletes stay deletes', async () => {
  const u = Date.now() + 60000;
  await otherDevice([{ k: 'plan', i: 'plm', u, d: { id: 'plm', title: 'Merge', start: '2027-01-02', end: '2027-01-02', cat: 'work', outcome: 'done' } }]);
  await otherDevice([{ k: 'plan', i: 'plm', u: u + 1, d: { id: 'plm', title: 'Merge 2', start: '2027-01-02', end: '2027-01-02', cat: 'work' } }]);
  assert.deepEqual((await serverRec('plan', 'plm')).d, { id: 'plm', title: 'Merge 2', start: '2027-01-02', end: '2027-01-02', cat: 'work', outcome: 'done' });
  await otherDevice([{ k: 'plan', i: 'plm', u: u + 2, d: { id: 'plm', title: 'Merge 2', start: '2027-01-02', end: '2027-01-02', cat: 'work', outcome: null } }]);
  assert.equal('outcome' in (await serverRec('plan', 'plm')).d, false);
  // Arrays are replaced, not merged.
  await otherDevice([{ k: 'goal', i: 'q4', u, d: { text: 'a\nb', done: false, items: [{ id: 'x', text: 'a', done: false }, { id: 'y', text: 'b', done: false }] } }]);
  await otherDevice([{ k: 'goal', i: 'q4', u: u + 1, d: { text: 'a', done: false, items: [{ id: 'x', text: 'a', done: true }] } }]);
  assert.deepEqual((await serverRec('goal', 'q4')).d.items, [{ id: 'x', text: 'a', done: true }]);
  // A deletion is a deletion, and a record created again starts fresh.
  await otherDevice([{ k: 'plan', i: 'plm', u: u + 3, d: null }]);
  assert.equal((await serverRec('plan', 'plm')).d, null);
  await otherDevice([{ k: 'plan', i: 'plm', u: u + 4, d: { id: 'plm', title: 'Again', start: '2027-01-03', end: '2027-01-03', cat: 'work' } }]);
  assert.equal('outcome' in (await serverRec('plan', 'plm')).d, false);
  // An older edit still loses.
  await otherDevice([{ k: 'plan', i: 'plm', u: 1, d: { id: 'plm', title: 'Stale', start: '2027-01-03', end: '2027-01-03', cat: 'work' } }]);
  assert.equal((await serverRec('plan', 'plm')).d.title, 'Again');
});

await atest('the server rejects bad records', async () => {
  assert.throws(() => server.parseBody({ since: 0, push: [{ k: 'nope', i: 'x', u: 1, d: null }] }), /kind/);
  assert.throws(() => server.parseBody({ since: -1 }), /since/);
});

store.setTouchHandler(null);

console.log(`\n${passed} tests passed`);
