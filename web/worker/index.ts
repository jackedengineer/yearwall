/**
 * Year Wall API. Serves POST /api/sync for the phone app and the web app;
 * every other path is the React app (static assets, see cloudflare.config.ts).
 */
import { env } from 'cloudflare:workers';
import { BadRequest, parseBody, SCHEMA, sync, type SqlDb } from './sync-db';

const db: SqlDb = {
  async batch(stmts) {
    const res = await env.DB.batch(stmts.map((s) => env.DB.prepare(s.sql).bind(...s.params)));
    return res.map((r) => (r.results ?? []) as Record<string, unknown>[]);
  },
};

// Create the tables once per Worker instance (cheap no-ops after the first time).
let ready: Promise<unknown> | null = null;
const ensureSchema = () =>
  (ready ??= db.batch(SCHEMA.map((sql) => ({ sql, params: [] }))).catch((e) => {
    ready = null;
    throw e;
  }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Compares the request's key with SYNC_KEY in constant time. */
async function authorized(req: Request): Promise<boolean> {
  const expected = env.SYNC_KEY;
  if (!expected) return false;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(got)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true });
    if (url.pathname !== '/api/sync') return json({ error: 'Not found' }, 404);
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
    if (!(await authorized(req))) return json({ error: 'Wrong sync key' }, 401);
    try {
      const { since, push } = parseBody(await req.json());
      await ensureSchema();
      return json(await sync(db, since, push));
    } catch (e) {
      if (e instanceof BadRequest || e instanceof SyntaxError) return json({ error: e.message }, 400);
      console.error('sync failed', e);
      return json({ error: 'Server error' }, 500);
    }
  },
} satisfies ExportedHandler;
