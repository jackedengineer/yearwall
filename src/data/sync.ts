/**
 * Sync engine shared by the phone app and the web app.
 *
 * Every edit marks its record "dirty" with the time it happened. A sync sends
 * the dirty records to the server and, in the same request, receives every
 * record changed since the last sync (the server's `rev` cursor). When both
 * sides edited the same record, the later edit wins.
 *
 * Where the bookkeeping lives is up to the platform (SQLite on the phone,
 * memory + localStorage on the web), through the SyncStore interface.
 */
import { allKeys, readRecord, type Kind, type Rec } from './records';
import { applyRemote } from './store';

export interface SyncStore {
  /** Server cursor from the last sync, or -1 if this device has never synced. */
  cursor(): number;
  setCursor(rev: number): void;
  /** When this record was last edited, as far as this device knows. */
  clock(k: Kind, i: string): number | undefined;
  mark(k: Kind, i: string, u: number, dirty: boolean): void;
  dirty(): { k: Kind; i: string; u: number }[];
  /** The record was sent: clear its dirty flag unless it was edited again since. */
  clean(k: Kind, i: string, u: number): void;
  /** Run several writes together (one SQLite transaction on the phone). */
  batch(fn: () => void): void;
}

export type Endpoint = { url: string; key: string };
export type SyncState = 'off' | 'syncing' | 'ok' | 'offline' | 'error';
export type SyncStatus = { state: SyncState; lastSync: number | null; message: string; pending: number };

type Response = { rev: number; pull: Rec[] };

const CHUNK = 250;

export class AuthError extends Error {}

export function createSync(opts: {
  store: SyncStore;
  endpoint: () => Endpoint | null;
  /** How long to wait after an edit before sending it. */
  debounceMs?: number;
  /** On the first sync, send records that exist only on this device (the phone's data from before sync).
   *  Off for the web app, whose starting state is empty defaults that must never overwrite real data. */
  adoptLocal?: boolean;
  fetchFn?: typeof fetch;
}) {
  const { store } = opts;
  const fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let status: SyncStatus = { state: 'off', lastSync: null, message: '', pending: 0 };
  const listeners = new Set<(s: SyncStatus) => void>();
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  const setStatus = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch, pending: store.dirty().length };
    listeners.forEach((l) => l(status));
  };

  async function post(ep: Endpoint, body: { since: number; push: Rec[] }): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetchFn(ep.url.replace(/\/+$/, '') + '/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ep.key}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.status === 401) throw new AuthError('The sync key is wrong.');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return (await res.json()) as Response;
    } finally {
      clearTimeout(t);
    }
  }

  /** Apply what the server sent, skipping records this device changed more recently. */
  function applyPulled(recs: Rec[]) {
    const fresh = recs.filter((r) => {
      const c = store.clock(r.k, r.i);
      return c === undefined || r.u > c;
    });
    if (!fresh.length) return;
    store.batch(() => {
      applyRemote(fresh);
      fresh.forEach((r) => store.mark(r.k, r.i, r.u, false));
    });
  }

  async function run() {
    const ep = opts.endpoint();
    if (!ep) return setStatus({ state: 'off', message: 'Not connected' });
    setStatus({ state: 'syncing', message: 'Syncing' });
    try {
      let since = store.cursor();
      if (since < 0) {
        // First sync on this device: take everything from the server, then send
        // whatever exists only here (data made before sync was set up).
        const res = await post(ep, { since: 0, push: [] });
        applyPulled(res.pull);
        if (opts.adoptLocal !== false) {
          const now = Date.now();
          store.batch(() => allKeys().forEach((x) => store.clock(x.k, x.i) === undefined && store.mark(x.k, x.i, now, true)));
        }
        store.setCursor(res.rev);
        since = res.rev;
      }
      for (let round = 0; round < 50; round++) {
        const dirty = store.dirty().slice(0, CHUNK);
        const push: Rec[] = dirty.map(({ k, i, u }) => ({ k, i, u, d: readRecord(k, i) }));
        const res = await post(ep, { since, push });
        store.batch(() => dirty.forEach(({ k, i, u }) => store.clean(k, i, u)));
        applyPulled(res.pull);
        store.setCursor(res.rev);
        since = res.rev;
        if (!store.dirty().length) break;
      }
      setStatus({ state: 'ok', lastSync: Date.now(), message: 'Up to date' });
    } catch (e: any) {
      if (e instanceof AuthError) setStatus({ state: 'error', message: e.message });
      else setStatus({ state: 'offline', message: e?.name === 'AbortError' ? 'Server did not answer' : 'Offline, will retry' });
    }
  }

  async function syncNow(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await run();
      } while (again);
    })();
    try {
      await running;
    } finally {
      running = null;
    }
  }

  return {
    /** Record a local edit and send it shortly. */
    touch(k: Kind, i: string) {
      const prev = store.clock(k, i) ?? 0;
      store.mark(k, i, Math.max(Date.now(), prev + 1), true);
      if (!opts.endpoint()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void syncNow();
      }, opts.debounceMs ?? 800);
    },
    syncNow,
    /** Sync every `ms` milliseconds (also syncs right away). */
    start(ms: number) {
      if (interval) clearInterval(interval);
      interval = setInterval(() => void syncNow(), ms);
      void syncNow();
    },
    stop() {
      if (interval) clearInterval(interval);
      interval = null;
    },
    status: () => status,
    subscribe(fn: (s: SyncStatus) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

export type Sync = ReturnType<typeof createSync>;
