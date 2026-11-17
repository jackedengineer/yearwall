/**
 * Server side of Year Wall sync. Stores every record as JSON in one D1
 * (SQLite) table. `rev` is a counter that goes up with every write, so a
 * device asks for "everything with rev > the last rev I saw".
 *
 * Talks to the database through a tiny interface so the same code runs on
 * D1 in the Worker and on node:sqlite in the tests (scripts/data.test.mjs).
 * Plain TypeScript with erasable syntax only, so Node can run it directly.
 */

export interface SqlDb {
  /** Runs the statements in order, atomically, and returns each statement's rows. */
  batch(stmts: { sql: string; params: unknown[] }[]): Promise<Record<string, unknown>[][]>;
}

export type WireRec = { k: string; i: string; d: unknown; u: number };

export const KINDS = ['settings', 'chapter', 'habit', 'plan', 'week', 'goal', 'post', 'income', 'log', 'journal'];
const MAX_PUSH = 1000;

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS records (
     kind TEXT NOT NULL,
     id TEXT NOT NULL,
     data TEXT,
     updated_at INTEGER NOT NULL,
     rev INTEGER NOT NULL,
     PRIMARY KEY (kind, id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_records_rev ON records(rev)`,
  `CREATE TABLE IF NOT EXISTS counter (name TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL)`,
  `INSERT OR IGNORE INTO counter (name, value) VALUES ('rev', 0)`,
];

// One statement for the whole push: the records arrive as one JSON array.
// A record only replaces the stored one if it was edited later (last write wins).
const UPSERT = `
INSERT INTO records (kind, id, data, updated_at, rev)
SELECT json_extract(value, '$.k'), json_extract(value, '$.i'), json_extract(value, '$.d'), json_extract(value, '$.u'),
       (SELECT value FROM counter WHERE name = 'rev')
FROM json_each(?) WHERE true
ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, rev = excluded.rev
WHERE excluded.updated_at > records.updated_at`;

export class BadRequest extends Error {}

export function parseBody(body: unknown): { since: number; push: WireRec[] } {
  const b = body as { since?: unknown; push?: unknown };
  if (!b || typeof b !== 'object') throw new BadRequest('Body must be a JSON object');
  const since = b.since;
  if (typeof since !== 'number' || !Number.isInteger(since) || since < 0) throw new BadRequest('since must be a whole number');
  const push = b.push ?? [];
  if (!Array.isArray(push)) throw new BadRequest('push must be a list');
  if (push.length > MAX_PUSH) throw new BadRequest(`Send at most ${MAX_PUSH} records at a time`);
  push.forEach((r: any) => {
    if (!r || !KINDS.includes(r.k)) throw new BadRequest('Unknown record kind');
    if (typeof r.i !== 'string' || !r.i || r.i.length > 200) throw new BadRequest('Bad record id');
    if (typeof r.u !== 'number' || !Number.isFinite(r.u) || r.u < 0) throw new BadRequest('Bad record time');
    if (r.d !== null && typeof r.d !== 'object') throw new BadRequest('Record data must be an object or null');
  });
  return { since, push: push as WireRec[] };
}

/** Saves pushed records, then returns everything changed since `since` and the new cursor. */
export async function sync(db: SqlDb, since: number, push: WireRec[]) {
  const stmts: { sql: string; params: unknown[] }[] = [];
  if (push.length) {
    const rows = push.map((r) => ({ k: r.k, i: r.i, u: Math.round(r.u), d: r.d === null ? null : JSON.stringify(r.d) }));
    stmts.push({ sql: `UPDATE counter SET value = value + 1 WHERE name = 'rev'`, params: [] });
    stmts.push({ sql: UPSERT, params: [JSON.stringify(rows)] });
  }
  stmts.push({ sql: `SELECT value AS rev FROM counter WHERE name = 'rev'`, params: [] });
  stmts.push({ sql: `SELECT kind, id, data, updated_at FROM records WHERE rev > ? ORDER BY rev`, params: [since] });
  const res = await db.batch(stmts);
  const rev = Number(res[res.length - 2][0]?.rev ?? 0);
  const pull = res[res.length - 1].map((r) => ({
    k: String(r.kind),
    i: String(r.id),
    d: r.data === null ? null : JSON.parse(String(r.data)),
    u: Number(r.updated_at),
  }));
  return { rev, pull };
}
