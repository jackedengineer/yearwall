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
  assert.equal(db.all('PRAGMA user_version')[0].user_version, 2);
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

// A phone: fresh SQLite, template data, sync wired up like the app does it.
function phone(key = KEY) {
  const pdb = adapter();
  store.initStore(pdb);
  const local = syncLocal.sqliteSyncStore();
  const engine = syncLib.createSync({ store: local, endpoint: () => ({ url: 'https://example.test', key }), fetchFn: fakeFetch, debounceMs: 0 });
  store.setTouchHandler(engine.touch);
  return { pdb, local, engine };
}

let A = phone();

await atest('first sync sends everything the phone already has', async () => {
  await A.engine.syncNow();
  assert.equal(A.engine.status().state, 'ok');
  assert.equal(A.local.dirty().length, 0);
  assert.equal((await serverRecs()).length, records.allKeys().length);
  assert.equal((await serverRec('plan', 'pl4')).d.title, 'Vipassana');
  assert.ok(A.local.cursor() >= 1);
});

await atest('an edit on the phone reaches the server', async () => {
  store.actions.savePlan({ ...S.meta.plans.find((p) => p.id === 'pl2'), title: 'Mini-retreat (5 h)' });
  store.actions.setValue(H('h_med'), '2026-11-18', 40);
  assert.equal(A.local.dirty().length, 2);
  await A.engine.syncNow();
  assert.equal((await serverRec('plan', 'pl2')).d.title, 'Mini-retreat (5 h)');
  assert.deepEqual((await serverRec('log', '2026-11-18|h_med')).d, { v: 40 });
  assert.equal(A.local.dirty().length, 0);
});

await atest('edits and deletes from another device arrive on the phone and in SQLite', async () => {
  const later = Date.now() + 5000;
  await otherDevice([
    { k: 'plan', i: 'pl9', u: later, d: { id: 'pl9', title: 'Made on the web', start: '2027-02-01', end: '2027-02-03', cat: 'work' } },
    { k: 'post', i: 'p001', u: later, d: null },
    { k: 'log', i: '2026-11-18|h_med', u: later, d: null },
  ]);
  await A.engine.syncNow();
  assert.equal(S.meta.plans.find((p) => p.id === 'pl9').title, 'Made on the web');
  assert.equal(S.posts.some((p) => p.id === 'p001'), false);
  assert.equal(logic.valueOn(H('h_med'), '2026-11-18'), 0);
  const saved = repo.loadAll();
  assert.ok(saved.meta.plans.some((p) => p.id === 'pl9'));
  assert.equal(saved.posts.some((p) => p.id === 'p001'), false);
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
  const meditation = { ...H('h_med'), sort: 3 };
  await otherDevice([{ k: 'habit', i: 'h_med', u: Date.now() + 20000, d: meditation }]);
  await A.engine.syncNow();
  assert.deepEqual(S.meta.habits.map((h) => h.id), ['h_yoga', 'h_read', 'h_log', 'h_med']);
  assert.deepEqual(repo.loadAll().meta.habits.map((h) => h.id), ['h_yoga', 'h_read', 'h_log', 'h_med']);
});

await atest('a new phone takes the server data instead of its own template', async () => {
  const B = phone();
  assert.ok(S.posts.some((p) => p.id === 'p001')); // fresh template
  await B.engine.syncNow();
  assert.equal(S.posts.some((p) => p.id === 'p001'), false);
  assert.equal(S.meta.plans.find((p) => p.id === 'pl2').title, 'Mini-retreat (5 h)');
  assert.equal(S.meta.weeks['5'].focus, 'newer web focus');
  assert.equal(B.local.dirty().length, 0);
  A = B;
});

await atest('importing a backup syncs removed records as deletions', async () => {
  const backup = JSON.parse(store.actions.exportJson());
  backup.meta.plans = backup.meta.plans.filter((p) => p.id !== 'pl9');
  store.actions.importJson(JSON.stringify(backup));
  await A.engine.syncNow();
  assert.equal((await serverRec('plan', 'pl9')).d, null);
  assert.ok((await serverRec('plan', 'pl1')).d);
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
  const web = syncLib.createSync({ store: (() => {
    const m = new Map(); let c = -1;
    return { cursor: () => c, setCursor: (r) => { c = r; }, clock: (k, i) => m.get(k + i)?.u, mark: (k, i, u, d) => m.set(k + i, { k, i, u, d }),
      dirty: () => [...m.values()].filter((x) => x.d).map(({ k, i, u }) => ({ k, i, u })), clean: (k, i, u) => { const x = m.get(k + i); if (x && x.u === u) x.d = false; }, batch: (fn) => fn() };
  })(), endpoint: () => ({ url: 'https://example.test', key: KEY }), fetchFn: fakeFetch, adoptLocal: false });
  await web.syncNow();
  assert.equal(web.status().state, 'ok');
  assert.deepEqual(await serverRec('settings', 'settings'), before);
});

await atest('the server rejects bad records', async () => {
  assert.throws(() => server.parseBody({ since: 0, push: [{ k: 'nope', i: 'x', u: 1, d: null }] }), /kind/);
  assert.throws(() => server.parseBody({ since: -1 }), /since/);
});

store.setTouchHandler(null);

console.log(`\n${passed} tests passed`);
